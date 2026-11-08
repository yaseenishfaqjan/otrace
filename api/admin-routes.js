/**
 * /admin and /api/admin. The second mount is what the current nginx /api/
 * proxy can reach before a dedicated /admin location is applied.
 * ADMIN_PASSWORD unset: every path is a plain 404, with no login form.
 */
import express from 'express';

import {
  ADMIN_COOKIE,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  adminPasswordSet,
  clearSessionCookie,
  createLoginLimiter,
  createSessionCodec,
  passwordsMatch,
  readCookie,
  sessionCookie,
} from './admin-auth.js';
import {
  createOrderCollector,
  filterOrders,
  ordersToCsv,
  paginate,
  summarize,
} from './admin-orders.js';
import {
  renderLogin,
  renderMessage,
  renderOrder,
  renderOrders,
} from './admin-page.js';

const ORDER_ID = /^cs_[A-Za-z0-9_]+$/;

function one(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').trim().slice(0, 200);
}

function readQuery(req) {
  const q = req.query || {};
  const from = one(q.from);
  const to = one(q.to);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  return {
    tab: one(q.tab) === 'open' ? 'open' : 'paid',
    q: one(q.q),
    status: one(q.status).toLowerCase(),
    from: day.test(from) ? from : '',
    to: day.test(to) ? to : '',
    country: one(q.country).toUpperCase(),
    product: one(q.product).toLowerCase(),
    page: Number.parseInt(one(q.page), 10) || 1,
    saved: one(q.saved) === '1',
  };
}

function orderId(raw) {
  const id = String(raw || '');
  if (!ORDER_ID.test(id) || id.length > 255) return '';
  return id;
}

function cleanText(value, max, { keepNewlines = false } = {}) {
  const stripped = String(value ?? '').replace(
    keepNewlines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g : /[\u0000-\u001f]/g,
    '',
  ).trim();
  return stripped.slice(0, max);
}

export function cleanFulfilment(body = {}) {
  const status = String(body.status || '').toLowerCase();
  const allowed = ['unfulfilled', 'packed', 'shipped', 'delivered'];
  if (!allowed.includes(status)) return { error: 'Pick a fulfilment status.' };
  return {
    status,
    trackingNumber: cleanText(body.tracking_number, 128),
    carrier: cleanText(body.carrier, 64),
    note: cleanText(body.note, 2000, { keepNewlines: true }),
  };
}

function sorted(orders) {
  return orders.slice().sort((a, b) => (b.created || 0) - (a.created || 0) || String(b.id).localeCompare(String(a.id)));
}

export function mountAdmin(app, deps = {}) {
  const password = deps.password || (() => process.env.ADMIN_PASSWORD || '');
  const codec = createSessionCodec({
    secret: deps.sessionSecret || (() => process.env.ADMIN_SESSION_SECRET || ''),
    password,
  });
  const now = deps.now || (() => Date.now());
  const limiter = createLoginLimiter({
    max: deps.loginMax ?? LOGIN_MAX_ATTEMPTS,
    windowMs: deps.loginWindowMs ?? LOGIN_WINDOW_MS,
    now,
  });
  const collector = createOrderCollector({ cacheMs: deps.cacheMs ?? 30_000 });
  const siteUrl = deps.siteUrl || process.env.SITE_URL || 'https://otrace.co';
  const storeOf = () => (typeof deps.store === 'function' ? deps.store() : deps.store);
  const stripeOf = () => (typeof deps.stripe === 'function' ? deps.stripe() : deps.stripe);

  const router = express.Router({ strict: false });

  router.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cache-Control', 'private, no-store');
    res.set('Referrer-Policy', 'no-referrer');
    if (!adminPasswordSet(password())) return res.status(404).type('text/plain; charset=utf-8').send('Not found');
    next();
  });

  const authed = (req) => Boolean(codec.read(readCookie(req.headers.cookie, ADMIN_COOKIE), now()));

  async function load() {
    const store = storeOf();
    if (!store) {
      const err = new Error('order store is not ready');
      err.status = 503;
      throw err;
    }
    return collector.collect({ stripe: stripeOf(), store, siteUrl, now: now() });
  }

  function fail(res, err) {
    console.error('[admin] failed:', err.message);
    const status = err.status || 500;
    const message = status === 503 ? 'Orders are not available yet.' : 'Could not load orders.';
    res.status(status).type('text/plain; charset=utf-8').send(message);
  }

  router.get('/', (req, res, next) => {
    if (!authed(req)) return res.status(200).type('html').send(renderLogin({ base: req.baseUrl, error: '' }));
    return next();
  }, async (req, res) => {
    try {
      const loaded = await load();
      const query = readQuery(req);
      const summary = summarize(loaded.orders, now());
      const filtered = sorted(filterOrders(loaded.orders, query));
      const page = paginate(filtered, query.page);
      const countries = [...new Set(loaded.orders.map((order) => order.shipping?.country).filter(Boolean))].sort();
      res.type('html').send(renderOrders({
        base: req.baseUrl,
        orders: page.rows,
        page,
        summary,
        query,
        warning: loaded.warning,
        countries,
      }));
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const base = req.baseUrl || '/admin';
    if (limiter.blocked(ip)) {
      return res.status(429).type('html').send(renderLogin({
        base,
        error: 'Too many attempts. Wait and try again.',
      }));
    }
    const given = String(req.body?.password ?? '');
    const ok = given.length > 0 && given.length <= 200 && passwordsMatch(given, password());
    if (!ok) {
      limiter.fail(ip);
      const limited = limiter.blocked(ip);
      return res.status(limited ? 429 : 401).type('html').send(renderLogin({
        base,
        error: limited ? 'Too many attempts. Wait and try again.' : 'That password is wrong.',
      }));
    }
    limiter.reset(ip);
    res.append('Set-Cookie', sessionCookie(codec.issue(now())));
    return res.redirect(303, base);
  });

  router.post('/logout', (req, res) => {
    res.append('Set-Cookie', clearSessionCookie());
    return res.redirect(303, req.baseUrl || '/admin');
  });

  router.get('/export.csv', async (req, res) => {
    if (!authed(req)) return res.status(401).type('text/plain; charset=utf-8').send('Login required');
    try {
      const loaded = await load();
      const query = readQuery(req);
      const rows = sorted(filterOrders(loaded.orders, query));
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="otrace-orders.csv"');
      res.send(ordersToCsv(rows));
    } catch (err) {
      fail(res, err);
    }
  });

  router.get('/orders/:id', async (req, res) => {
    const base = req.baseUrl || '/admin';
    if (!authed(req)) return res.status(200).type('html').send(renderLogin({ base, error: '' }));
    const id = orderId(req.params.id);
    if (!id) return res.status(404).type('text/plain; charset=utf-8').send('Not found');
    try {
      const loaded = await load();
      const order = loaded.orders.find((row) => row.id === id);
      if (!order) {
        return res.status(404).type('html').send(renderMessage({
          base,
          title: 'No such order',
          message: 'That order is not in Stripe or the saved orders.',
        }));
      }
      res.type('html').send(renderOrder({
        base,
        order,
        saved: readQuery(req).saved,
        error: '',
      }));
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/orders/:id', async (req, res) => {
    const base = req.baseUrl || '/admin';
    if (!authed(req)) return res.status(401).type('text/plain; charset=utf-8').send('Login required');
    const id = orderId(req.params.id);
    if (!id) return res.status(404).type('text/plain; charset=utf-8').send('Not found');
    try {
      const loaded = await load();
      const order = loaded.orders.find((row) => row.id === id);
      if (!order) return res.status(404).type('text/plain; charset=utf-8').send('Not found');
      const cleaned = cleanFulfilment(req.body || {});
      if (cleaned.error) {
        return res.status(400).type('html').send(renderOrder({ base, order, saved: false, error: cleaned.error }));
      }
      const store = storeOf();
      await store.saveFulfilment(id, cleaned);
      return res.redirect(303, `${base}/orders/${id}?saved=1`);
    } catch (err) {
      fail(res, err);
    }
  });

  router.use((req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send('Not found');
  });

  app.use('/admin', router);
  app.use('/api/admin', router);
  return router;
}

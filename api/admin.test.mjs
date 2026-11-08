import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import express from 'express';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_COOKIE,
  LOGIN_MAX_ATTEMPTS,
  SESSION_MS,
  adminPasswordSet,
  createSessionCodec,
  passwordsMatch,
} from './admin-auth.js';
import {
  belongsToSite,
  formatBoth,
  sessionsForSite,
  summarize,
} from './admin-orders.js';
import { mountAdmin } from './admin-routes.js';
import { ADMIN_TABLE_SQL, createMemoryOrderStore, ensureAdminTables, recordCheckoutSession } from './admin-store.js';
import { INDEXABLE_PATHS, publicBody, robotsTxt, sitemapXml } from './theme/discovery.js';
import { robotsTxt as siteRobots } from '../site/scripts/seo-public.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const NOW = Date.parse('2026-11-08T12:00:00+05:00');
const CREATED = Math.floor(Date.parse('2026-11-08T09:00:00+05:00') / 1000);

const paid = {
  id: 'cs_test_admin01',
  status: 'complete',
  payment_status: 'paid',
  created: CREATED,
  livemode: false,
  success_url: 'https://otrace.co/order/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://otrace.co/cart',
  amount_subtotal: 14000,
  amount_total: 13500,
  currency: 'usd',
  customer_details: {
    name: 'Ayesha Khan',
    email: 'ayesha@example.com',
    phone: '+923001112233',
  },
  shipping_details: {
    name: 'Ayesha Khan',
    address: {
      line1: '12 Clifton',
      city: 'Karachi',
      state: 'SD',
      postal_code: '75600',
      country: 'PK',
    },
  },
  shipping_cost: { amount_total: 0 },
  total_details: {
    amount_discount: 1000,
    amount_shipping: 0,
    amount_tax: 500,
    breakdown: {
      discounts: [{ amount: 1000, discount: { promotion_code: { code: 'WELCOME' } } }],
    },
  },
  payment_intent: { id: 'pi_test_admin01', amount: 13500, amount_refunded: 0 },
  metadata: {
    items: JSON.stringify([
      { s: 'OT-HOOD', z: 'M', c: 'Warm Cream', q: 1 },
      { s: 'OT-PANT', z: 'M', c: 'Warm Cream', q: 1 },
    ]),
    items_parts: '1',
    subtotal_cents: '14000',
  },
  line_items: {
    data: [
      {
        quantity: 1,
        amount_total: 7000,
        description: 'OTRACE Oversized Hoodie — Warm Cream, M (set of two)',
        price: {
          unit_amount: 7000,
          product: {
            name: 'OTRACE Oversized Hoodie — Warm Cream, M (set of two)',
            metadata: { sku: 'OT-HOOD', size: 'M', colour: 'Warm Cream' },
          },
        },
      },
      {
        quantity: 1,
        amount_total: 7000,
        description: 'OTRACE Wide-Leg Sweatpant — Warm Cream, M (set of two)',
        price: {
          unit_amount: 7000,
          product: {
            name: 'OTRACE Wide-Leg Sweatpant — Warm Cream, M (set of two)',
            metadata: { sku: 'OT-PANT', size: 'M', colour: 'Warm Cream' },
          },
        },
      },
    ],
  },
};

const abandoned = {
  id: 'cs_test_abandoned1',
  status: 'expired',
  payment_status: 'unpaid',
  created: CREATED - 3600,
  livemode: false,
  success_url: 'https://otrace.co/order/success?session_id={CHECKOUT_SESSION_ID}',
  amount_total: 8000,
  currency: 'usd',
  customer_details: { name: 'Left Behind', email: 'left@example.com', phone: '' },
  metadata: {
    items: JSON.stringify([{ s: 'OT-HOOD', z: 'L', c: 'Onyx Black', q: 1 }]),
    items_parts: '1',
  },
};

const foreign = {
  id: 'cs_test_foreign01',
  status: 'complete',
  payment_status: 'paid',
  created: CREATED,
  livemode: false,
  success_url: 'https://shop.example/done',
  amount_total: 500,
  currency: 'usd',
  customer_details: { name: 'Foreign Shop', email: 'foreign@example.com' },
};

function stripeMock() {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        async list(params) {
          calls.push(params);
          const data = [paid, abandoned, foreign].filter((session) => session.status === params.status);
          return { data, has_more: false };
        },
      },
    },
  };
}

function boot({ password = 's3cret-password', stripe = stripeMock(), loginMax, store = createMemoryOrderStore() } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  mountAdmin(app, {
    password: () => password,
    sessionSecret: () => 'test-session-secret',
    store: () => store,
    stripe: () => stripe,
    siteUrl: 'https://otrace.co',
    now: () => NOW,
    cacheMs: 0,
    loginMax,
  });
  return { app, store, stripe };
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function setCookie(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = list.find((line) => line.startsWith(`${ADMIN_COOKIE}=`)) || '';
  return raw.split(';')[0];
}

async function text(res) {
  return res.text();
}

test('password match is exact and a blank password is not enabled', () => {
  assert.equal(passwordsMatch('s3cret-password', 's3cret-password'), true);
  assert.equal(passwordsMatch('s3cret-password', 's3cret-passworD'), false);
  assert.equal(passwordsMatch('short', 's3cret-password'), false);
  assert.equal(adminPasswordSet(''), false);
  assert.equal(adminPasswordSet('x'), true);
  assert.equal(LOGIN_MAX_ATTEMPTS, 8);
  assert.equal(SESSION_MS, 12 * 60 * 60 * 1000);
});

test('a derived session key round-trips and a different password does not', () => {
  const issuedAt = 1_700_000_000_000;
  const writer = createSessionCodec({ secret: () => '', password: () => 'same-password' });
  const reader = createSessionCodec({ secret: () => '', password: () => 'same-password' });
  const token = writer.issue(issuedAt);
  assert.ok(reader.read(token, issuedAt + 1000));
  assert.equal(reader.read(token, issuedAt + SESSION_MS), null);
  const other = createSessionCodec({ secret: () => '', password: () => 'other-password' });
  assert.equal(other.read(token, issuedAt + 1000), null);
});

test('ADMIN_PASSWORD unset is a 404 with no order data', async () => {
  const previous = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  const stripe = stripeMock();
  const app = express();
  mountAdmin(app, {
    store: () => createMemoryOrderStore(),
    stripe: () => stripe,
    siteUrl: 'https://otrace.co',
  });
  const server = await listen(app);
  try {
    for (const path of ['/admin', '/admin/orders/cs_test_admin01', '/admin/export.csv', '/api/admin']) {
      const res = await fetch(server.base + path);
      assert.equal(res.status, 404, path);
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.equal(await text(res), 'Not found');
    }
    assert.equal(stripe.calls.length, 0);
  } finally {
    if (previous == null) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
    await server.close();
  }
});

test('login is required, a wrong password is rejected, and Stripe data renders after sign-in', async () => {
  const { app, store, stripe } = boot();
  await store.insertLegacy({
    ...paid,
    customer_details: { name: 'Old Name', email: 'old@example.com', phone: '' },
  });
  await store.insertLegacy({
    id: 'cs_test_legacyonly1',
    status: 'complete',
    payment_status: 'paid',
    created: CREATED,
    livemode: false,
    amount_subtotal: 8000,
    amount_total: 8000,
    currency: 'usd',
    customer_details: { name: 'Legacy Buyer', email: 'legacy@example.com', phone: '+15551212' },
    shipping_details: {
      name: 'Legacy Buyer',
      address: { line1: '1 Main', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' },
    },
    metadata: {
      items: JSON.stringify([{ s: 'OT-HOOD', z: 'S', c: 'Onyx Black', q: 1 }]),
      items_parts: '1',
    },
  });
  const server = await listen(app);
  try {
    const anonymous = await fetch(server.base + '/admin');
    const loginHtml = await text(anonymous);
    assert.equal(anonymous.status, 200);
    assert.match(loginHtml, /name="robots" content="noindex, nofollow"/);
    assert.equal(anonymous.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.doesNotMatch(loginHtml, /<script/i);
    assert.doesNotMatch(loginHtml, /ayesha@example.com/);
    assert.equal(stripe.calls.length, 0);

    const wrong = await fetch(server.base + '/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'nope' }),
      redirect: 'manual',
    });
    assert.equal(wrong.status, 401);
    assert.equal(setCookie(wrong), '');
    assert.match(await text(wrong), /wrong/i);
    assert.equal(stripe.calls.length, 0);

    const signed = await fetch(server.base + '/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 's3cret-password' }),
      redirect: 'manual',
    });
    assert.equal(signed.status, 303);
    const cookieLine = setCookie(signed);
    assert.match(cookieLine, new RegExp(`^${ADMIN_COOKIE}=`));
    const header = signed.headers.get('set-cookie') || '';
    assert.match(header, /HttpOnly/i);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Strict/);
    const cookie = cookieLine;

    const home = await fetch(server.base + '/admin', { headers: { cookie } });
    const html = await text(home);
    assert.equal(home.status, 200);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /Ayesha Khan/);
    assert.match(html, /ayesha@example.com/);
    assert.match(html, /\+923001112233/);
    assert.match(html, /Karachi/);
    assert.match(html, /\bPK\b/);
    assert.match(html, /Warm Cream/);
    assert.match(html, /WELCOME/);
    assert.match(html, /\$10\.00/);
    assert.match(html, /\$5\.00/);
    assert.match(html, /\$135\.00/);
    assert.match(html, /cs_test_admin01/);
    assert.match(html, /legacy@example.com/);
    assert.doesNotMatch(html, /Old Name/);
    assert.doesNotMatch(html, /old@example.com/);
    assert.doesNotMatch(html, /foreign@example.com/);
    assert.doesNotMatch(html, /left@example.com/);
    const when = formatBoth(CREATED);
    assert.match(html, new RegExp(when.utc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(when.pkt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(html.includes('>Today</h2><p class="count">2</p>'));
    assert.match(html, /M <b>2<\/b>/);
    assert.match(html, /Warm Cream <b>2<\/b>/);

    const detail = await fetch(server.base + '/admin/orders/cs_test_admin01', { headers: { cookie } });
    const detailHtml = await text(detail);
    assert.equal(detail.status, 200);
    assert.match(detailHtml, /12 Clifton/);
    assert.match(detailHtml, /75600/);
    assert.match(detailHtml, /None/);
    assert.match(detailHtml, /Paid/);
    assert.match(detailHtml, /https:\/\/dashboard\.stripe\.com\/test\/payments\/pi_test_admin01/);
    assert.doesNotMatch(detailHtml, /<script/i);

    const hidden = await fetch(server.base + '/admin/orders/cs_test_admin01');
    const hiddenHtml = await text(hidden);
    assert.match(hiddenHtml, /Sign in/);
    assert.doesNotMatch(hiddenHtml, /ayesha@example.com/);
    assert.doesNotMatch(hiddenHtml, /12 Clifton/);

    const open = await fetch(server.base + '/admin?tab=open', { headers: { cookie } });
    const openHtml = await text(open);
    assert.match(openHtml, /left@example.com/);
    assert.match(openHtml, /Onyx Black/);
    assert.doesNotMatch(openHtml, /ayesha@example.com/);

    const missed = await fetch(server.base + '/admin?q=nobody-at-all', { headers: { cookie } });
    assert.match(await text(missed), /No orders in this view/);
    const found = await fetch(server.base + '/admin?q=legacy@example.com', { headers: { cookie } });
    const foundHtml = await text(found);
    assert.match(foundHtml, /legacy@example.com/);
    assert.doesNotMatch(foundHtml, /ayesha@example.com/);

    const csvLocked = await fetch(server.base + '/admin/export.csv');
    assert.equal(csvLocked.status, 401);
    assert.equal(await text(csvLocked), 'Login required');
    const csv = await fetch(server.base + '/admin/export.csv', { headers: { cookie } });
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    const csvBody = await text(csv);
    assert.match(csvBody, /ayesha@example.com/);
    assert.match(csvBody, /cs_test_admin01/);
    assert.match(csvBody, /WELCOME/);
    assert.doesNotMatch(csvBody, /foreign@example.com/);

    const saved = await fetch(server.base + '/admin/orders/cs_test_admin01', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        status: 'shipped',
        tracking_number: '1Z999',
        carrier: 'UPS',
        note: 'Leave with the guard',
      }),
      redirect: 'manual',
    });
    assert.equal(saved.status, 303);
    assert.match(saved.headers.get('location') || '', /saved=1/);
    const after = await fetch(server.base + '/admin/orders/cs_test_admin01?saved=1', { headers: { cookie } });
    const afterHtml = await text(after);
    assert.match(afterHtml, /Saved/);
    assert.match(afterHtml, /value="shipped" selected/);
    assert.match(afterHtml, /value="1Z999"/);
    assert.match(afterHtml, /value="UPS"/);
    assert.match(afterHtml, /Leave with the guard/);
    const again = await fetch(server.base + '/admin/orders/cs_test_admin01', { headers: { cookie } });
    assert.match(await text(again), /value="1Z999"/);

    const unauthSave = await fetch(server.base + '/admin/orders/cs_test_admin01', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: 'delivered' }),
    });
    assert.equal(unauthSave.status, 401);
    assert.doesNotMatch(await text(unauthSave), /ayesha@example.com/);

    const expired = createSessionCodec({
      secret: () => 'test-session-secret',
      password: () => 's3cret-password',
    }).issue(Date.parse('2026-11-07T00:00:00Z'));
    const stale = await fetch(server.base + '/admin', { headers: { cookie: `${ADMIN_COOKIE}=${expired}` } });
    const staleHtml = await text(stale);
    assert.match(staleHtml, /Sign in/);
    assert.doesNotMatch(staleHtml, /ayesha@example.com/);

    const out = await fetch(server.base + '/admin/logout', {
      method: 'POST',
      headers: { cookie },
      redirect: 'manual',
    });
    assert.equal(out.status, 303);
    assert.match(out.headers.get('set-cookie') || '', /Max-Age=0/);
  } finally {
    await server.close();
  }
});

test('repeated wrong passwords are rate limited', async () => {
  const { app } = boot({ loginMax: 2 });
  const server = await listen(app);
  try {
    const first = await fetch(server.base + '/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'nope' }),
      redirect: 'manual',
    });
    assert.equal(first.status, 401);
    const second = await fetch(server.base + '/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'nope' }),
      redirect: 'manual',
    });
    assert.equal(second.status, 429);
    const limited = await text(second);
    assert.match(limited, /Too many attempts/);
    assert.doesNotMatch(limited, /ayesha/);
  } finally {
    await server.close();
  }
});

test('summary counts paid orders on the Asia/Karachi calendar', () => {
  const today = CREATED;
  const yesterday = Math.floor(Date.parse('2026-11-07T23:00:00+05:00') / 1000);
  const summary = summarize([
    {
      sessionStatus: 'complete',
      paymentStatus: 'paid',
      created: today,
      totalCents: 13500,
      refundedCents: 0,
      items: [{ size: 'M', colour: 'Warm Cream', quantity: 2 }],
    },
    {
      sessionStatus: 'complete',
      paymentStatus: 'paid',
      created: yesterday,
      totalCents: 8000,
      refundedCents: 0,
      items: [{ size: 'S', colour: 'Onyx Black', quantity: 1 }],
    },
    { sessionStatus: 'expired', paymentStatus: 'unpaid', created: today, totalCents: 8000, items: [] },
  ], NOW);
  assert.equal(summary.today.count, 1);
  assert.equal(summary.today.revenueCents, 13500);
  assert.equal(summary.days7.count, 2);
  assert.equal(summary.days7.revenueCents, 21500);
  assert.equal(summary.days30.aovCents, 10750);
  assert.equal(summary.units.size.M, 2);
  assert.equal(summary.units.colour['Onyx Black'], 1);
});

test('a session is this shop only when the host or the checkout metadata says so', () => {
  assert.equal(belongsToSite({ success_url: 'https://nototrace.co/order/success' }, 'https://otrace.co'), false);
  assert.equal(belongsToSite(paid, 'https://otrace.co'), true);
  assert.equal(sessionsForSite([foreign], 'https://otrace.co').length, 1);
  assert.deepEqual(sessionsForSite([foreign, paid], 'https://otrace.co').map((session) => session.id), [paid.id]);
});

test('recording a checkout session keeps the orders insert and adds a cache row', async () => {
  const sql = [];
  const pool = {
    async query(statement) {
      sql.push(statement);
      return [[]];
    },
  };
  await recordCheckoutSession(pool, paid);
  assert.match(sql[0], /INSERT IGNORE INTO orders/);
  assert.match(sql[0], /stripe_session_id/);
  assert.match(sql[1], /INSERT INTO order_cache/);
  assert.doesNotMatch(sql.join('\n'), /DROP|TRUNCATE|DELETE FROM/i);
  const tables = [];
  await ensureAdminTables({
    async query(statement) {
      tables.push(statement);
      return [[]];
    },
  });
  assert.deepEqual(tables, ADMIN_TABLE_SQL);
  assert.ok(ADMIN_TABLE_SQL.every((statement) => statement.startsWith('CREATE TABLE IF NOT EXISTS')));
});

test('/admin is outside the sitemap, llms.txt, and robots allow list', () => {
  const site = 'https://otrace.co';
  const sitemap = sitemapXml(site);
  assert.doesNotMatch(sitemap, /\/admin/);
  assert.ok(!INDEXABLE_PATHS.some((path) => path === '/admin' || path.startsWith('/admin/')));
  const robots = robotsTxt(site);
  assert.match(robots, /Disallow: \/admin/);
  const gpt = robots.split('User-agent: GPTBot\n')[1].split('\nUser-agent:')[0];
  assert.match(gpt, /Disallow: \/admin/);
  assert.equal(siteRobots(site), robots);
  assert.equal(fs.readFileSync(`${repoRoot}/seo/robots.txt`, 'utf8'), robots);
  const llms = String(publicBody('/llms.txt', site).body);
  assert.doesNotMatch(llms, /\/admin/);
  assert.doesNotMatch(String(publicBody('/identity.json', site).body), /\/admin/);
  assert.doesNotMatch(String(publicBody('/ai.txt', site).body), /\/admin/);

  const nginx = fs.readFileSync(`${repoRoot}/deploy/nginx-theme-routes.conf`, 'utf8');
  assert.ok(nginx.indexOf('location = /admin {') < nginx.indexOf('rewrite ^ /api/theme-preview/not-found break;'));
  assert.match(nginx, /location \^~ \/admin\//);
  const compose = fs.readFileSync(`${repoRoot}/deploy/docker-compose.yml`, 'utf8');
  assert.match(compose, /ADMIN_PASSWORD:/);
  assert.match(compose, /ADMIN_SESSION_SECRET:/);
  assert.match(compose, /STRIPE_WEBHOOK_SECRET:/);
  const example = fs.readFileSync(`${repoRoot}/deploy/.env.example`, 'utf8');
  assert.match(example, /^ADMIN_PASSWORD=/m);
  assert.match(example, /^ADMIN_SESSION_SECRET=/m);
  assert.match(example, /^STRIPE_WEBHOOK_SECRET=/m);
});

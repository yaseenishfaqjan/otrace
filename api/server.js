/**
 * OTRACE — checkout / payment / order backend.
 *
 * The storefront is a static bundle with no server of its own, so this service
 * supplies the three things it cannot do itself:
 *   1. turn a browser cart into a Stripe Checkout Session (prices resolved
 *      server-side, never trusted from the client),
 *   2. receive Stripe's webhook and record the paid order,
 *   3. email the customer and the shop.
 *
 * Stripe's hosted Checkout collects the card, billing and shipping address, so
 * no card data ever touches this server or the browser bundle.
 */

import express from 'express';
import Stripe from 'stripe';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { createMailer } from './mailer.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

import { LOGO_CID, orderEmail, welcomeEmail } from './emails.js';
import {
  findBySlug,
  PRODUCTS,
  publicProducts,
  SHIPPING,
  CURRENCY,
  buildLineItems,
  packItems,
  unpackItems,
  subtotalCents,
  formatMoney,
} from './catalog.js';
import { submitIndexNow } from './indexnow.js';
import { ensureLeadColumns, handleContact, handleSubscribe, inquiryLabel } from './leads.js';
import { klaviyoConfig } from './klaviyo.js';
import { createThemeRenderer } from './theme/render-page.js';
import { toShopifyProduct } from './theme/shopify-shape.js';
import { PAGES, pageContent } from './theme/pages.js';
import {
  CART_COOKIE,
  addLine,
  cartJson,
  changeLine,
  decodeVariantId,
  readCartCookie,
  writeCartCookie,
} from './theme/cart.js';
import { rawBodyFor } from './theme/form-body.js';
import { createCheckoutSession } from './checkout-session.js';

const {
  PORT = 3000,
  SITE_URL = 'https://otrace.co',
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY,
  RESEND_FROM,
  DB_HOST = 'db',
  DB_USER,
  DB_PASSWORD,
  DB_NAME = 'otrace',
  SMTP_HOST,
  SMTP_PORT = '465',
  SMTP_USER,
  SMTP_PASSWORD,
  SHOP_EMAIL,
} = process.env;

// A thrown error in any one route must never take the whole service down — an
// admin query bug once killed a sibling process and with it checkout.
process.on('unhandledRejection', (r) => console.error('[fatal-guard] unhandled rejection:', r));
process.on('uncaughtException', (e) => console.error('[fatal-guard] uncaught exception:', e));

const app = express();
app.set('trust proxy', 1);

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;
if (!stripe) console.warn('[boot] STRIPE_SECRET_KEY not set — /api/checkout will refuse.');

/* ------------------------------------------------------------------ database */

let pool;

async function initDatabase() {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      stripe_session_id  VARCHAR(255) NOT NULL UNIQUE,
      payment_intent     VARCHAR(255) NULL,
      email              VARCHAR(255) NULL,
      customer_name      VARCHAR(255) NULL,
      phone              VARCHAR(64)  NULL,
      amount_total_cents INT NOT NULL DEFAULT 0,
      currency           VARCHAR(10)  NOT NULL DEFAULT 'usd',
      payment_status     VARCHAR(50)  NULL,
      items_json         JSON NULL,
      shipping_json      JSON NULL,
      created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      email                     VARCHAR(255) NOT NULL UNIQUE,
      source                    VARCHAR(64)  NOT NULL DEFAULT 'footer',
      path                      VARCHAR(255) NULL,
      product_slug              VARCHAR(128) NULL,
      size                      VARCHAR(32)  NULL,
      colour                    VARCHAR(64)  NULL,
      phone                     VARCHAR(32)  NULL,
      form_id                   VARCHAR(64)  NULL,
      marketing_consent_at      DATETIME NULL,
      marketing_consent_method  VARCHAR(64) NULL,
      sms_consent               TINYINT(1) NOT NULL DEFAULT 0,
      whatsapp_consent          TINYINT(1) NOT NULL DEFAULT 0,
      unsubscribed              TINYINT(1) NOT NULL DEFAULT 0,
      created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      email        VARCHAR(255) NOT NULL,
      subject      VARCHAR(255) NULL,
      message      TEXT NOT NULL,
      inquiry_type VARCHAR(64) NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // CREATE TABLE IF NOT EXISTS does not add columns to a table that already
  // exists. Older databases get the lead columns here.
  await ensureLeadColumns(pool);

  console.log('[boot] database ready');
}

/* --------------------------------------------------------------------- email */

const mailer =
  SMTP_HOST && SMTP_USER && SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      })
    : null;
/**
 * Resend over HTTPS first, SMTP second. The cPanel mailbox this shop sends
 * from lives on a host that is unreachable from this VPS on every port, so
 * SMTP alone delivered nothing at all - see mailer.js.
 */
const mail = createMailer({
  resendApiKey: RESEND_API_KEY,
  from: RESEND_FROM || `"OTRACE" <${SHOP_EMAIL || SMTP_USER}>`,
  smtpTransport: mailer,
  // The logo rides as a cid: attachment over SMTP; Resend gets the public URL.
  cidBase: `${SITE_URL.replace(/\/$/, '')}/email`,
});

console.log(`[boot] email providers: ${mail.describe()}`);

/** Never let a mail failure lose an order: it is already committed by now. */
// The logo rides inside every message (emails.js explains why it is not a link).
const LOGO_ATTACHMENT = {
  filename: 'otrace.png',
  path: fileURLToPath(new URL('./assets/otrace-logo-email.png', import.meta.url)),
  cid: LOGO_CID,
};

async function send({ to, subject, html, text }) {
  // attachments are the SMTP path only; Resend rewrites cid: to a public URL.
  return mail.deliver({ to, subject, html, text, attachments: [LOGO_ATTACHMENT] });
}

async function sendWelcome(email) {
  // One SMTP note, and only when SMTP is configured. The three-email welcome
  // sequence is a Klaviyo Flow, not this function. See seo/LEAD-CAPTURE.md.
  const built = welcomeEmail({ siteUrl: SITE_URL.replace(/\/$/, '') });
  await send({ to: email, subject: built.subject, html: built.html, text: built.text });
}

/* -------------------------------------------- webhook (raw body must be first) */

/**
 * Registered BEFORE express.json(): Stripe signs the raw bytes, so any JSON
 * parsing ahead of this invalidates the signature.
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Acknowledge immediately; Stripe retries on anything but a fast 2xx.
  res.json({ received: true });
  if (event.type !== 'checkout.session.completed') return;

  try {
    /**
     * We have ALREADY told Stripe 200, so it will never retry this event. That
     * makes every network call below a place where a paid order can vanish:
     * measured 26 Oct 2026, this container intermittently fails DNS with
     * EAI_AGAIN, and the failure landed inside this very handler.
     *
     * Stripe sends the whole session in the event, and the only reason to
     * re-fetch is freshness - `line_items` is expanded here and never read.
     * So: try the fetch a few times, and if DNS is still broken, fall back to
     * what the event already carried rather than losing the order.
     */
    let session = event.data.object;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
          expand: ['line_items'],
        });
        break;
      } catch (err) {
        const cause = err?.cause?.code || err?.code || err?.message;
        console.warn(`[webhook] session retrieve attempt ${attempt} failed (${cause})`);
        if (attempt === 3) {
          console.warn('[webhook] using the session from the event payload instead');
        } else {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    const items = unpackItems(session.metadata);
    const shipping =
      session.collected_information?.shipping_details ?? session.shipping_details ?? null;
    const reference = `OT-${String(session.id).slice(-8).toUpperCase()}`;

    // INSERT IGNORE + a UNIQUE session id makes redelivered webhooks safe.
    await pool.query(
      `INSERT IGNORE INTO orders
         (stripe_session_id, payment_intent, email, customer_name, phone,
          amount_total_cents, currency, payment_status, items_json, shipping_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        session.customer_details?.email ?? null,
        session.customer_details?.name ?? shipping?.name ?? null,
        session.customer_details?.phone ?? null,
        session.amount_total ?? 0,
        session.currency ?? CURRENCY,
        session.payment_status ?? null,
        JSON.stringify(items),
        JSON.stringify(shipping),
      ],
    );
    console.log(`[order] ${reference} recorded (${session.customer_details?.email})`);

    const order = {
      reference,
      items,
      shipping,
      amountTotalCents: session.amount_total ?? 0,
      shippingCents: session.shipping_cost?.amount_total ?? 0,
    };

    const built = orderEmail({ siteUrl: SITE_URL.replace(/\/$/, ''), order });
    await send({
      to: session.customer_details?.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    if (SHOP_EMAIL) {
      const lines = items
        .map((i) => `  ${i.quantity} x ${i.name} (${[i.colour, i.size].filter(Boolean).join(', ')})`)
        .join('\n');
      const a = shipping?.address ?? {};
      await send({
        to: SHOP_EMAIL,
        subject: `New order ${reference} — ${formatMoney(order.amountTotalCents)}`,
        text: `${reference}\n\n${lines}\n\nTotal ${formatMoney(order.amountTotalCents)}\n\n` +
          `${session.customer_details?.name ?? ''}\n${session.customer_details?.email ?? ''}\n` +
          `${session.customer_details?.phone ?? ''}\n` +
          `${[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join('\n')}\n`,
      });
    }
  } catch (err) {
    console.error('[webhook] processing failed:', err);
  }
});

app.use(express.json({ limit: '32kb' }));

/* -------------------------------------------------------------------- routes */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripe: stripe ? 'configured' : 'not configured',
    mail: mailer ? 'configured' : 'not configured',
    klaviyo: klaviyoConfig().configured ? 'configured' : 'not configured',
  });
});

/** Lets the storefront read authoritative pricing rather than hardcoding it. */
/* ------------------------------------------------ Kalles theme preview ---- */

/**
 * The Kalles theme, rendered from its own Liquid against our catalogue.
 *
 * Deliberately mounted under /api/ so nothing on the server has to change:
 * nginx already sends /api/* here, while / still goes to the React build. The
 * live shop is untouched and this is reachable only by its own URL.
 *
 * The asset base is handed to the engine so {{ 'x.css' | asset_url }} points
 * at the path we actually serve them from.
 */
const THEME_ROOT = fileURLToPath(new URL('../theme', import.meta.url));
const THEME_ASSET_BASE = '/api/theme-assets';
// Everything the theme fetches hangs off this prefix, so the preview needs no
// nginx change and cannot collide with the live React storefront at '/'.
const THEME_ROUTES_ROOT = '/api/theme-preview/';

let themeRenderer = null;
if (fs.existsSync(THEME_ROOT)) {
  try {
    themeRenderer = createThemeRenderer({
      themeRoot: THEME_ROOT,
      siteUrl: SITE_URL.replace(/\/$/, ''),
      assetBase: THEME_ASSET_BASE,
      routesRoot: THEME_ROUTES_ROOT,
    });
    app.use(THEME_ASSET_BASE, express.static(path.join(THEME_ROOT, 'assets'), {
      maxAge: '1h',
      setHeaders: (res) => res.setHeader('X-Theme-Preview', '1'),
    }));
    console.log('[boot] Kalles theme preview at /api/theme-preview/product/:slug');
  } catch (err) {
    console.warn('[boot] theme preview unavailable:', err.message);
  }
}

/* ---- Shopify AJAX endpoints the theme's own JS calls ---- */

/** Parse one cookie without pulling in a dependency for it. */
const readCookie = (req, name) =>
  String(req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='))
    ?.slice(name.length + 1);

const sendCart = (req, res, lines) => {
  res.cookie
    ? res.cookie(CART_COOKIE, writeCartCookie(lines), { httpOnly: true, sameSite: 'lax', path: '/' })
    : res.setHeader('Set-Cookie', `${CART_COOKIE}=${writeCartCookie(lines)}; Path=/; HttpOnly; SameSite=Lax`);
  res.json(cartJson(lines, { siteUrl: SITE_URL }));
};

const cartLines = (req) => readCartCookie(readCookie(req, CART_COOKIE));

app.get('/api/theme-preview/products/:handle.js', (req, res) => {
  const product = findBySlug(req.params.handle);
  if (!product) return res.status(404).json({ error: 'not found' });
  res.json(toShopifyProduct(product, { siteUrl: SITE_URL }));
});

app.get('/api/theme-preview/cart.js', (req, res) => {
  res.json(cartJson(cartLines(req), { siteUrl: SITE_URL }));
});

app.post('/api/theme-preview/cart/add.js', rawBodyFor(), (req, res) => {
  const body = req.body || {};
  // Shopify accepts one item or an items[] array; the theme sends both shapes.
  const incoming = Array.isArray(body.items) ? body.items : [body];
  let lines = cartLines(req);
  for (const item of incoming) {
    const decoded = decodeVariantId(item.id ?? item.variant_id);
    if (!decoded) return res.status(422).json({ status: 422, message: 'Cannot find variant' });
    const quantity = Math.min(10, Math.max(1, Number.parseInt(item.quantity, 10) || 1));
    lines = addLine(lines, { ...decoded, quantity });
  }
  sendCart(req, res, lines);
});

app.post('/api/theme-preview/cart/change.js', rawBodyFor(), (req, res) => {
  const body = req.body || {};
  const quantity = Math.min(10, Math.max(0, Number.parseInt(body.quantity, 10) || 0));
  sendCart(req, res, changeLine(cartLines(req), body.id ?? body.line, quantity));
});

app.post('/api/theme-preview/cart/update.js', rawBodyFor(), (req, res) => {
  const updates = (req.body || {}).updates || {};
  let lines = cartLines(req);
  for (const [variantId, qty] of Object.entries(updates)) {
    lines = changeLine(lines, variantId, Math.min(10, Math.max(0, Number.parseInt(qty, 10) || 0)));
  }
  sendCart(req, res, lines);
});

/**
 * The theme's cart form posts here.
 *
 * Shopify's /cart accepts a POST from the cart form and, when the submit
 * button is named "checkout", sends the customer on to the payment page. The
 * form is a plain POST and not fetch(), so the answer has to be a redirect -
 * returning JSON here leaves the customer looking at raw JSON.
 */
const sendThemeHtml = (res, html) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  // A preview must never be indexed while the real pages exist.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.send(html);
};

app.get('/api/theme-preview/', async (req, res) => {
  if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
  try {
    sendThemeHtml(res, await themeRenderer.renderPage('index', {
      title: 'OTRACE',
      page_title: 'OTRACE — AW2026',
    }, 'index'));
  } catch (err) {
    console.error('[theme] home render failed:', err.message);
    res.status(500).send('Theme render failed: ' + err.message);
  }
});

/**
 * The shop listing.
 *
 * `/shop` is the whole catalogue; `/shop/:handle` narrows it. The categories
 * come from the products themselves rather than a second list to keep in step.
 */
const COLLECTIONS = {
  hoodies: { title: 'Hoodies', match: (p) => p.sku === 'OT-HOOD' },
  bottoms: { title: 'Bottoms', match: (p) => p.sku === 'OT-PANT' },
};

/**
 * The content pages: /sizing, /garment-dyed, /lookbook, /contact.
 *
 * Their copy and every number in it come from shared data, so the prose cannot
 * drift away from the catalogue the way the old garment-dyed page did - it was
 * still quoting the previous retail figures on the live site long after
 * the prices changed to $100 list / $80.
 */
app.get('/api/theme-preview/page/:handle', async (req, res) => {
  if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
  const page = pageContent(req.params.handle);
  if (!page) return res.status(404).send('No such page.');
  try {
    sendThemeHtml(res, await themeRenderer.renderPage('page', page, 'page'));
  } catch (err) {
    console.error('[theme] page render failed:', err.message);
    res.status(500).send('Theme render failed: ' + err.message);
  }
});

app.get('/api/theme-preview/shop/:handle?', async (req, res) => {
  if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
  const handle = req.params.handle;
  const group = handle ? COLLECTIONS[handle] : null;
  if (handle && !group) return res.status(404).send('No such collection.');

  const products = Object.values(PRODUCTS).filter((p) => (group ? group.match(p) : true));
  try {
    sendThemeHtml(res, await themeRenderer.renderCollection({
      handle: handle ?? 'all',
      title: group ? group.title : 'AW2026',
      description: '450 GSM garment-dyed heavyweight fleece.',
      products,
    }));
  } catch (err) {
    console.error('[theme] collection render failed:', err.message);
    res.status(500).send('Theme render failed: ' + err.message);
  }
});

app.get('/api/theme-preview/cart', async (req, res) => {
  if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
  try {
    sendThemeHtml(res, await themeRenderer.renderPage('cart', {
      cart: cartJson(cartLines(req), { siteUrl: SITE_URL }),
      title: 'Your cart',
      page_title: 'Your cart — OTRACE',
    }));
  } catch (err) {
    console.error('[theme] cart render failed:', err.message);
    res.status(500).send('Theme render failed: ' + err.message);
  }
});

app.post('/api/theme-preview/cart', rawBodyFor(), async (req, res) => {
  const lines = cartLines(req);
  const wantsCheckout = Object.prototype.hasOwnProperty.call(req.body || {}, 'checkout');

  if (!wantsCheckout) {
    // An "update cart" submit: apply the quantities and show the cart again.
    return res.redirect(303, THEME_ROUTES_ROOT + 'cart');
  }

  try {
    const { session, error } = await createCheckoutSession(stripe, lines, { siteUrl: SITE_URL });
    if (error) {
      console.warn('[theme checkout] refused:', error);
      return res.status(400).send(error);
    }
    console.log(`[theme checkout] session ${session.id} for ${formatMoney(session.amount_total ?? 0)}`);
    res.redirect(303, session.url);
  } catch (err) {
    console.error('[theme checkout] failed:', err.message);
    res.status(500).send('Checkout could not start. Please try again.');
  }
});

app.get('/api/theme-preview/product/:slug', async (req, res) => {
  if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
  const product = findBySlug(req.params.slug);
  if (!product) return res.status(404).send('No such product.');
  try {
    const html = await themeRenderer.renderProduct(product);
    res.set('Content-Type', 'text/html; charset=utf-8');
    // A preview must never be indexed while the real pages exist.
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.send(html);
  } catch (err) {
    console.error('[theme] product render failed:', err.message);
    res.status(500).send('Theme render failed: ' + err.message);
  }
});

app.get('/api/products', (_req, res) => {
  res.json({ currency: CURRENCY, shipping: SHIPPING, products: publicProducts(SITE_URL) });
});

app.post('/api/checkout', async (req, res) => {
  try {
    const { session, error, status } = await createCheckoutSession(stripe, req.body?.items, {
      siteUrl: SITE_URL,
    });
    if (error) return res.status(status).json({ error });
    console.log(`[checkout] session ${session.id} for ${formatMoney(session.amount_total ?? 0)}`);
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[checkout] failed:', err.message);
    res.status(500).json({ error: 'Checkout could not start. Please try again.' });
  }
});

async function respondSubscribe(req, res, defaults = {}) {
  try {
    const result = await handleSubscribe(pool, { ...defaults, ...(req.body ?? {}) }, { sendWelcome });
    res.status(result.status).json(result.json);
  } catch (err) {
    console.error('[subscribe] failed:', err.message);
    res.status(500).json({ error: 'Could not add you just now. Please try again.' });
  }
}

app.post('/api/subscribe', (req, res) => respondSubscribe(req, res));

// Same store and the same Klaviyo profile as /api/subscribe. The default
// form id is waitlist when the client does not send one.
app.post('/api/waitlist', (req, res) => respondSubscribe(req, res, {
  source: 'waitlist',
  formId: 'waitlist',
}));

app.post('/api/contact', async (req, res) => {
  try {
    // Written to the database BEFORE any attempt to email, so a mail outage
    // cannot lose an enquiry.
    const result = await handleContact(pool, req.body);
    if (result.status !== 200) return res.status(result.status).json(result.json);

    const { lead } = result;
    if (SHOP_EMAIL) {
      const type = inquiryLabel(lead.inquiryType);
      await send({
        to: SHOP_EMAIL,
        subject: `Enquiry${type ? ` (${type})` : ''}: ${lead.subject || 'no subject'} — ${lead.name}`,
        text: `${type ? `Type: ${type}\n` : ''}${lead.name} <${lead.email}>\n\n${lead.message}`,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] failed:', err.message);
    res.status(500).json({ error: 'Could not send that just now. Please try again.' });
  }
});

/* ---------------------------------------------------------------------- boot */

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[boot] OTRACE API listening on ${PORT}`);
      // After a deploy the process restarts. Ping IndexNow then, so Bing (what
      // ChatGPT searches) is not waiting on someone to remember. A failure here
      // must not stop checkout: the key file may not be on the host yet.
      if (process.env.INDEXNOW_SUBMIT === '0') return;
      submitIndexNow(SITE_URL)
        .then((result) => console.log('[indexnow]', JSON.stringify(result)))
        .catch((err) => console.error('[indexnow]', err));
    });
  })
  .catch((err) => {
    console.error('[boot] database failed:', err.message);
    process.exit(1);
  });

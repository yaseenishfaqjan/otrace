import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatMoney, PRODUCTS } from '../catalog.js';
import { createCheckoutSession } from '../checkout-session.js';
import { mountCartRoutes } from './cart-routes.js';
import {
  CART_COOKIE,
  SHARED_CART_TOKEN,
  cartCookieOptions,
  cartJson,
  changeLine,
  clearThemeCart,
  createCartStore,
  mintCartId,
  writeCartCookie,
} from './cart.js';

const HOOD = { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'XS', quantity: 1 };
const PANT = { sku: 'OT-PANT', colour: 'Warm Cream', size: 'M', quantity: 1 };

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function jar() {
  const cookies = new Map();
  return {
    header() {
      const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
      return cookie ? { cookie } : {};
    },
    absorb(res) {
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (!value) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    id() {
      return cookies.get(CART_COOKIE) || '';
    },
    set(name, value) {
      cookies.set(name, value);
    },
  };
}

async function call(base, basket, urlPath, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(base + urlPath, {
    method,
    headers: { ...basket.header(), ...headers },
    body,
    redirect: 'manual',
  });
  basket.absorb(res);
  const type = res.headers.get('content-type') || '';
  const payload = type.includes('json') ? await res.json() : await res.text();
  return { res, payload };
}

async function withCarts(fn, { themeRenderer = null, stripe = null, sessions } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const store = createCartStore();
  const seen = sessions || [];
  mountCartRoutes(app, {
    store,
    siteUrl: 'https://otrace.co',
    routesRoot: '/api/theme-preview/',
    themeRenderer,
    sendThemeHtml: (res, html, opts = {}) => {
      res.set('Content-Type', 'text/html; charset=utf-8');
      if (opts.noindex) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.send(html);
    },
    createCheckoutSession: async (client, items, opts) => {
      const result = await createCheckoutSession(client, items, opts);
      seen.push({ items, result });
      return result;
    },
    stripe,
  });
  const server = await listen(app);
  try {
    await fn({
      base: `http://127.0.0.1:${server.address().port}`,
      store,
      seen,
    });
  } finally {
    await close(server);
  }
}

const multipartAdd = (id, sections = 'cart-drawer') => {
  const boundary = '----otrace';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="id"',
    '',
    id,
    `--${boundary}`,
    'Content-Disposition: form-data; name="quantity"',
    '',
    '1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="sections"',
    '',
    sections,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return {
    body,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'x-requested-with': 'XMLHttpRequest',
    },
  };
};

test('cart JSON never uses the shared token', () => {
  const minted = cartJson([HOOD], { siteUrl: 'https://otrace.co' });
  const rejected = cartJson([HOOD], { siteUrl: 'https://otrace.co', token: SHARED_CART_TOKEN });
  const id = mintCartId();
  assert.notEqual(minted.token, SHARED_CART_TOKEN);
  assert.notEqual(rejected.token, SHARED_CART_TOKEN);
  assert.notEqual(minted.token, rejected.token);
  assert.equal(cartJson([HOOD], { token: id }).token, id);
  assert.equal(minted.items[0].index, 0);
  assert.equal(cartCookieOptions({ secure: true }).secure, true);
});

test('a 1-based line index changes only that row', () => {
  let lines = [HOOD, PANT];
  lines = changeLine(lines, 2, 3);
  assert.equal(lines[0].quantity, 1);
  assert.equal(lines[1].quantity, 3);
  lines = changeLine(lines, 1, 0);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].sku, 'OT-PANT');
  lines = changeLine(lines, 'OT-PANT-warm-cream-m', 0);
  assert.equal(lines.length, 0);
});

test('the shared token is not a cart, on disk or in memory', () => {
  const file = path.join(os.tmpdir(), `otrace-cart-${process.pid}-${Date.now()}.json`);
  const kept = mintCartId();
  fs.writeFileSync(file, JSON.stringify({
    [SHARED_CART_TOKEN]: { lines: [HOOD], seen: Date.now() },
    [kept]: { lines: [PANT], seen: Date.now() },
  }));
  try {
    const store = createCartStore({ file });
    assert.deepEqual(store.get(SHARED_CART_TOKEN), []);
    assert.equal(store.get(kept)[0].sku, 'OT-PANT');
    store.set(SHARED_CART_TOKEN, [HOOD]);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(Object.hasOwn(saved, SHARED_CART_TOKEN), false);
    assert.equal(saved[kept].lines[0].sku, 'OT-PANT');
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('two cookie jars do not share a cart', async () => {
  const stripe = {
    checkout: {
      sessions: {
        create: async (args) => ({
          id: 'cs_test',
          url: 'https://checkout.stripe.test/pay',
          amount_total: 8000,
          line_items: args.line_items,
        }),
      },
    },
  };

  await withCarts(async ({ base, seen }) => {
    const a = jar();
    const b = jar();
    const stranger = jar();

    const viewed = await call(base, a, '/api/theme-preview/cart.js');
    assert.equal(viewed.res.status, 200);
    assert.equal(viewed.payload.item_count, 0);
    assert.equal(viewed.payload.token, a.id());
    assert.notEqual(a.id(), SHARED_CART_TOKEN);
    assert.match(viewed.res.headers.get('cache-control') || '', /no-store/);
    assert.match(viewed.res.headers.getSetCookie().join(';'), /HttpOnly/i);

    const addA = multipartAdd('OT-HOOD-onyx-black-xs');
    const added = await call(base, a, '/api/theme-preview/cart/add.js', {
      method: 'POST',
      headers: addA.headers,
      body: addA.body,
    });
    assert.equal(added.res.status, 200);
    assert.equal(added.payload.item_count, 1);
    assert.equal(added.payload.token, a.id());
    assert.equal(added.payload.items[0].variant_title, 'Onyx Black / XS');
    assert.match(added.payload.sections['cart-drawer'], /cart-items-component/);
    assert.match(added.payload.sections['cart-drawer'], /Onyx Black \/ XS/);
    assert.equal(added.payload.token === SHARED_CART_TOKEN, false);

    const addB = await call(base, b, '/api/theme-preview/cart/add.js', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ id: 'OT-PANT-warm-cream-m', quantity: 1, sections: 'cart-drawer' }),
    });
    assert.equal(addB.payload.item_count, 1);
    assert.equal(addB.payload.items[0].sku, 'OT-PANT');
    assert.notEqual(b.id(), a.id());
    assert.notEqual(b.id(), SHARED_CART_TOKEN);

    const againA = await call(base, a, '/api/theme-preview/cart.js');
    const againB = await call(base, b, '/api/theme-preview/cart.js');
    const none = await call(base, stranger, '/api/theme-preview/cart.js');
    assert.equal(againA.payload.item_count, 1);
    assert.equal(againA.payload.items[0].sku, 'OT-HOOD');
    assert.equal(againB.payload.items[0].sku, 'OT-PANT');
    assert.equal(none.payload.item_count, 0);
    assert.notEqual(none.payload.token, a.id());
    assert.notEqual(none.payload.token, b.id());
    assert.equal(none.payload.items.some((item) => item.sku === 'OT-HOOD'), false);

    const shared = jar();
    shared.set(CART_COOKIE, SHARED_CART_TOKEN);
    const refused = await call(base, shared, '/api/theme-preview/cart.js');
    assert.equal(refused.payload.item_count, 0);
    assert.notEqual(shared.id(), SHARED_CART_TOKEN);
    assert.equal(refused.payload.items.some((item) => item.variant_title === 'Onyx Black / XS'), false);

    const bumped = await call(base, a, '/api/theme-preview/cart/change.js', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ line: 1, quantity: 2, sections: 'cart-drawer' }),
    });
    assert.equal(bumped.payload.item_count, 2);
    assert.equal(bumped.payload.items[0].quantity, 2);
    const stillB = await call(base, b, '/api/theme-preview/cart.js');
    assert.equal(stillB.payload.item_count, 1);

    const removed = await call(base, a, '/api/theme-preview/cart/change?line=1&quantity=0');
    assert.equal(removed.res.status, 303);
    const emptyA = await call(base, a, '/api/theme-preview/cart.js');
    assert.equal(emptyA.payload.item_count, 0);
    assert.equal((await call(base, b, '/api/theme-preview/cart.js')).payload.item_count, 1);

    const pay = await call(base, b, '/api/theme-preview/cart', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'updates[]=2&checkout=',
    });
    assert.equal(pay.res.status, 303);
    assert.equal(pay.res.headers.get('location'), 'https://checkout.stripe.test/pay');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].items.length, 1);
    assert.equal(seen[0].items[0].sku, 'OT-PANT');
    assert.equal(seen[0].items[0].colour, 'Warm Cream');
    assert.equal(seen[0].items[0].quantity, 2);
    assert.equal(seen[0].result.session.line_items[0].quantity, 2);
    assert.equal(seen[0].result.session.line_items[0].price_data.unit_amount, PRODUCTS['OT-PANT'].priceCents);
    assert.equal((await call(base, a, '/api/theme-preview/cart.js')).payload.item_count, 0);
  }, { stripe, themeRenderer: stubRenderer() });
});

test('a legacy line cookie stays with that browser, and a form add sets an id', async () => {
  await withCarts(async ({ base }) => {
    const legacy = jar();
    legacy.set(CART_COOKIE, writeCartCookie([HOOD]));
    const migrated = await call(base, legacy, '/api/theme-preview/cart.js');
    assert.equal(migrated.payload.item_count, 1);
    assert.equal(migrated.payload.items[0].variant_title, 'Onyx Black / XS');
    assert.equal(legacy.id(), migrated.payload.token);
    assert.notEqual(legacy.id(), SHARED_CART_TOKEN);
    assert.equal(legacy.id().startsWith('W3'), false);

    const other = jar();
    const empty = await call(base, other, '/api/theme-preview/cart.js');
    assert.equal(empty.payload.item_count, 0);

    const form = jar();
    const posted = await call(base, form, '/api/theme-preview/cart/add.js', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'id=OT-HOOD-onyx-black-xs&quantity=1',
    });
    assert.equal(posted.res.status, 303);
    assert.equal(posted.res.headers.get('location'), '/cart');
    assert.notEqual(form.id(), '');
    const owned = await call(base, form, '/api/theme-preview/cart.js');
    assert.equal(owned.payload.item_count, 1);
    assert.equal(owned.payload.token, form.id());
  }, { themeRenderer: stubRenderer() });
});

test('add.js drawer HTML is the real cart section for that line only', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const themeRenderer = createThemeRenderer({
    themeRoot,
    siteUrl: 'https://otrace.co',
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  await withCarts(async ({ base }) => {
    const a = jar();
    const add = multipartAdd('OT-HOOD-onyx-black-xs');
    const added = await call(base, a, '/api/theme-preview/cart/add.js', {
      method: 'POST',
      headers: add.headers,
      body: add.body,
    });
    const drawer = added.payload.sections['cart-drawer'] || '';
    assert.match(drawer, /cart-items-component/);
    assert.match(drawer, /OTRACE Oversized Hoodie/);
    assert.match(drawer, /Onyx Black \/ XS/);
    assert.ok(drawer.includes(formatMoney(PRODUCTS['OT-HOOD'].priceCents)));
    assert.equal(drawer.includes('OTRACE Wide-Leg Sweatpant'), false);
    assert.equal(added.payload.token, a.id());
  }, { themeRenderer });
});

test('order success clears only that visitor cart', () => {
  const store = createCartStore();
  const id = mintCartId();
  const other = mintCartId();
  store.set(id, [HOOD]);
  store.set(other, [PANT]);
  const cleared = [];
  clearThemeCart(
    { headers: { cookie: `${CART_COOKIE}=${id}` }, secure: false },
    { clearCookie(name) { cleared.push(name); } },
    store,
  );
  assert.deepEqual(cleared, [CART_COOKIE]);
  assert.equal(store.get(id).length, 0);
  assert.equal(store.get(other).length, 1);
});

function stubRenderer() {
  return {
    async renderCartSections(cart, ids) {
      assert.ok(ids.includes('cart-drawer'));
      assert.notEqual(cart.token, SHARED_CART_TOKEN);
      const item = cart.items[0];
      const label = item ? `${item.product.title} ${item.variant_title}` : '';
      return {
        'cart-drawer': `<div class="cart-items-component" data-count="${cart.item_count}">${label}</div>`,
      };
    },
    async renderPage(_name, scope) {
      return `<div data-count="${scope.cart.item_count}" data-token="${scope.cart.token}"></div>`;
    },
  };
}

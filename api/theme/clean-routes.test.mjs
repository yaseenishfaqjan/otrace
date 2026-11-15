/**
 * The storefront links to clean paths, and the old preview prefix still serves.
 *
 * Bing Webmaster Tools reported ERROR "Blocked by robots.txt" against
 * https://otrace.co/api/theme-preview/cart. The URL was not the problem:
 * robots.txt disallows /api/ on purpose, because /api/admin is the orders
 * desk. The problem was that the cart icon in the header pointed AT it, so
 * every page on the site linked to a URL crawlers are told not to fetch.
 *
 * Two halves, and each alone leaves the error in place:
 *   - the theme must PRINT clean paths (THEME_ROUTES_ROOT), and
 *   - the server must SERVE them.
 *
 * The legacy prefix stays registered so a cached page, an open tab or a
 * bookmark keeps working. It is served, just never printed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { PRODUCTS } from '../catalog.js';
import { createThemeRenderer } from './render-page.js';
import { mountCartRoutes } from './cart-routes.js';
import { createCartStore } from './cart.js';

const SITE = 'https://otrace.co';
// Colour handle then size, as decodeVariantId parses it.
const VARIANT = 'OT-HOOD-onyx-black-xs';
const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
const serverSrc = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

/**
 * The root the SERVER passes, not a value restated here.
 *
 * The first version of this file hard-coded '/' and so proved only that the
 * renderer emits clean links when handed a clean root - it stayed green with
 * server.js reverted to the preview prefix, which is the whole bug. Reading
 * the real constant is what joins "we print clean paths" to "the server is
 * configured to".
 */
const routesRoot = serverSrc.match(/const THEME_ROUTES_ROOT = '([^']*)';/)?.[1];

const theme = createThemeRenderer({
  themeRoot,
  siteUrl: SITE,
  assetBase: '/api/theme-assets',
  routesRoot,
});

/**
 * Every URL a crawler will actually FETCH from this HTML.
 *
 * href and src only. A POST form's `action` is deliberately excluded: the
 * newsletter and contact forms post to /api/subscribe and /api/contact, which
 * are real API endpoints and correctly behind the /api/ disallow. Bing did not
 * report either of them, and only reported the cart - because the cart was the
 * one that was an href. Including `action` here would fail the check on two
 * URLs that are right, with no fix available.
 *
 * Inline script and CSS strings are excluded for the same reason: the old
 * prefix survives in a `window.Shopify.routes.root` fallback that no crawler
 * reads.
 */
const linkedUrls = (html) =>
  [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

test('THEME_ROUTES_ROOT is the clean root, so no page prints the preview prefix', () => {
  assert.ok(routesRoot, 'THEME_ROUTES_ROOT is gone from server.js');
  assert.equal(routesRoot, '/');
});

test('no rendered page links to a path robots.txt disallows', async () => {
  const pages = {
    home: await theme.renderPage('index', {
      title: 'OTRACE', page_title: 'OTRACE', canonical_path: '/',
    }, 'index'),
    hoodie: await theme.renderProduct(PRODUCTS['OT-HOOD']),
    pant: await theme.renderProduct(PRODUCTS['OT-PANT']),
  };
  for (const [name, html] of Object.entries(pages)) {
    const blocked = linkedUrls(html).filter((url) => url.startsWith('/api/') && !url.startsWith('/api/theme-assets/'));
    assert.deepEqual(blocked, [], `${name} links to ${JSON.stringify(blocked)}`);
    // The cart has to be reachable — a page with no cart link would pass the
    // assertion above by having lost the feature.
    assert.ok(linkedUrls(html).includes('/cart'), `${name} has no /cart link`);
  }
});

test('the add-to-cart form posts to a path that is not disallowed', async () => {
  const html = await theme.renderProduct(PRODUCTS['OT-HOOD']);
  const actions = [...html.matchAll(/action="([^"]*cart[^"]*)"/g)].map((m) => m[1]);
  assert.ok(actions.length, 'the product page has no cart form');
  for (const action of actions) assert.ok(!action.startsWith('/api/'), action);
});

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

/** Both path sets answer: the clean one we print, the old one we still serve. */
test('the cart serves at the clean path AND the legacy prefix', async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  mountCartRoutes(app, {
    store: createCartStore(),
    siteUrl: SITE,
    routesRoot: '/',
    themeRenderer: null,
    sendThemeHtml: (res, html) => res.send(html),
    createCheckoutSession: async () => ({ error: 'not under test' }),
    stripe: null,
  });
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const prefix of ['', '/api/theme-preview']) {
      const label = prefix || '(clean)';
      const jar = { cookie: '' };
      const call = async (path, init = {}) => {
        const res = await fetch(base + prefix + path, {
          ...init,
          headers: { ...(init.headers || {}), accept: 'application/json', cookie: jar.cookie },
          redirect: 'manual',
        });
        const set = res.headers.getSetCookie?.() || [];
        if (set.length) jar.cookie = set.map((c) => c.split(';')[0]).join('; ');
        return res;
      };

      const empty = await call('/cart.js');
      assert.equal(empty.status, 200, `${label} GET /cart.js`);
      assert.equal((await empty.json()).item_count, 0, `${label} starts empty`);

      const added = await call('/cart/add.js', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: VARIANT, quantity: 1 }),
      });
      assert.equal(added.status, 200, `${label} POST /cart/add.js`);
      assert.equal((await added.json()).item_count, 1, `${label} added a line`);

      const read = await call('/cart.js');
      assert.equal((await read.json()).item_count, 1, `${label} kept the line`);

      const bumped = await call('/cart/update.js', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates: { [VARIANT]: 2 } }),
      });
      assert.equal(bumped.status, 200, `${label} POST /cart/update.js`);

      const removed = await call('/cart/change.js', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: VARIANT, quantity: 0 }),
      });
      assert.equal(removed.status, 200, `${label} POST /cart/change.js`);
      assert.equal((await removed.json()).item_count, 0, `${label} removed the line`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});

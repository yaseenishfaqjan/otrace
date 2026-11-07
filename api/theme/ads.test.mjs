import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { SIZES } from '../catalog.js';
import { merchantFeedXml, publicBody } from './discovery.js';
import { mountStorefront } from './mount-storefront.js';
import {
  adsEventsTag,
  loadVerifiedPurchase,
  metaPixelId,
  metaPixelTag,
  purchaseFromStripeSession,
  resetCapiDedupe,
  sendMetaPurchase,
  tiktokPixelId,
  tiktokPixelTag,
} from './ads.js';

const SITE = 'https://otrace.co';
const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
const META_ID = '123456789012345';
const TIKTOK_ID = 'C9ABCDEF1234567890';
const CAPI_TOKEN = 'test-capi-token-not-a-real-secret';
const ENV_KEYS = ['GA_MEASUREMENT_ID', 'OTRACE_GA_MEASUREMENT_ID', 'CLARITY_PROJECT_ID', 'OTRACE_CLARITY_PROJECT_ID', 'META_PIXEL_ID', 'TIKTOK_PIXEL_ID', 'META_CAPI_TOKEN'];

function withoutAdsEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function adsConfig(html) {
  const match = html.match(/<script type="application\/json" id="otrace-ads">([^<]*)<\/script>/);
  assert.ok(match, 'ads config missing');
  return JSON.parse(match[1]);
}

function countOf(html, needle) {
  return html.split(needle).length - 1;
}

describe('paid ads pixels', { concurrency: 1 }, () => {
test('purchase money is the Stripe session total, never a caller-supplied value', async () => {
  const taxed = purchaseFromStripeSession({
    id: 'cs_test_taxline01',
    payment_status: 'paid',
    amount_total: 15432,
    currency: 'usd',
    value: 1,
    line_items: {
      data: [{
        quantity: 1,
        price: {
          unit_amount: 8000,
          product: {
            name: 'OTRACE Oversized Hoodie — Onyx Black, M',
            metadata: { sku: 'OT-HOOD', size: 'M', colour: 'Onyx Black' },
          },
        },
      }],
    },
    metadata: {
      items: JSON.stringify([{ s: 'OT-HOOD', z: 'M', c: 'Onyx Black', q: 1 }]),
      items_parts: '1',
    },
  });
  assert.equal(taxed.value, 154.32);
  assert.equal(taxed.currency, 'USD');
  assert.deepEqual(taxed.content_ids, ['OT-HOOD']);
  assert.equal(taxed.content_type, 'product');
  assert.equal(taxed.num_items, 1);
  assert.equal(taxed.items[0].price, 80);
  assert.equal(taxed.event_id, 'purchase.cs_test_taxline01');
  assert.equal(taxed.transaction_id, 'cs_test_taxline01');

  const set = purchaseFromStripeSession({
    id: 'cs_live_paidset01',
    payment_status: 'paid',
    amount_total: 14000,
    currency: 'usd',
    metadata: {
      items: JSON.stringify([
        { s: 'OT-HOOD', z: 'M', c: 'Onyx Black', q: 1 },
        { s: 'OT-PANT', z: 'M', c: 'Onyx Black', q: 1 },
      ]),
      items_parts: '1',
    },
  });
  assert.equal(set.value, 140);
  assert.deepEqual(set.content_ids, ['OT-HOOD', 'OT-PANT']);
  assert.equal(set.num_items, 2);
  assert.equal(set.items[0].price + set.items[1].price, 140);

  assert.equal(purchaseFromStripeSession({
    id: 'cs_test_unpaid001',
    payment_status: 'unpaid',
    amount_total: 8000,
    currency: 'usd',
  }), null);
  assert.equal(purchaseFromStripeSession({
    id: 'not-a-session',
    payment_status: 'paid',
    amount_total: 8000,
    currency: 'usd',
  }), null);

  let called = false;
  const ignored = await loadVerifiedPurchase({
    checkout: { sessions: { async retrieve() { called = true; throw new Error('no'); } } },
  }, '1');
  assert.equal(called, false);
  assert.equal(ignored.purchase, null);
});

test('meta capi sends the session purchase once and skips when unconfigured', async () => {
  const saved = { ...process.env };
  withoutAdsEnv();
  resetCapiDedupe();
  const purchase = purchaseFromStripeSession({
    id: 'cs_test_capi00001',
    payment_status: 'paid',
    amount_total: 14000,
    currency: 'usd',
    metadata: {
      items: JSON.stringify([
        { s: 'OT-HOOD', z: 'L', c: 'Warm Cream', q: 1 },
        { s: 'OT-PANT', z: 'L', c: 'Warm Cream', q: 1 },
      ]),
      items_parts: '1',
    },
  });
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  };
  try {
    const skipped = await sendMetaPurchase(purchase, { email: 'buyer@example.com' }, fetchImpl);
    assert.equal(skipped.skipped, true);
    assert.equal(calls.length, 0);

    process.env.META_PIXEL_ID = META_ID;
    process.env.META_CAPI_TOKEN = CAPI_TOKEN;
    const sent = await sendMetaPurchase(purchase, {
      email: 'Buyer@Example.com',
      eventSourceUrl: `https://otrace.co/order/success?session_id=${purchase.transaction_id}`,
    }, fetchImpl);
    assert.equal(sent.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, new RegExp(`/v23\\.0/${META_ID}/events`));
    assert.match(calls[0].url, /access_token=/);
    const event = calls[0].body.data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, purchase.event_id);
    assert.equal(event.custom_data.value, 140);
    assert.equal(event.custom_data.currency, 'USD');
    assert.deepEqual(event.custom_data.content_ids, ['OT-HOOD', 'OT-PANT']);
    assert.equal(event.custom_data.num_items, 2);
    assert.equal(event.custom_data.order_id, purchase.transaction_id);
    assert.notEqual(event.user_data.em[0], 'buyer@example.com');
    assert.equal(event.user_data.em[0].length, 64);
    assert.equal(JSON.stringify(calls[0].body).includes('buyer@example.com'), false);

    const again = await sendMetaPurchase(purchase, {}, fetchImpl);
    assert.equal(again.reason, 'duplicate');
    assert.equal(calls.length, 1);
  } finally {
    resetCapiDedupe();
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});

test('pixels stay out of the theme until configured, then events use catalogue and session values', async () => {
  const saved = { ...process.env };
  withoutAdsEnv();
  const { createThemeRenderer } = await import('./render-page.js');
  const theme = await createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  try {
    assert.equal(metaPixelId(), '');
    assert.equal(metaPixelTag(), '');
    assert.equal(tiktokPixelId(), '');
    assert.equal(tiktokPixelTag(), '');
    assert.equal(adsEventsTag({}), '');
    process.env.META_PIXEL_ID = '12345"<script>';
    process.env.TIKTOK_PIXEL_ID = 'bad id';
    assert.equal(metaPixelTag(), '');
    assert.equal(tiktokPixelTag(), '');
    withoutAdsEnv();

    const bare = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
    for (const needle of ['connect.facebook.net', 'analytics.tiktok.com', 'fbevents.js', 'id="otrace-ads"', 'fbq(', 'ttq.']) {
      assert.equal(countOf(bare, needle), 0, needle);
    }

    process.env.META_PIXEL_ID = META_ID;
    process.env.TIKTOK_PIXEL_ID = TIKTOK_ID;
    const home = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
    const headEnd = home.indexOf('</head>');
    assert.equal(countOf(home, 'connect.facebook.net/en_US/fbevents.js'), 1);
    assert.equal(countOf(home, `fbq('init', '${META_ID}')`), 1);
    assert.equal(countOf(home, "fbq('track', 'PageView'"), 1);
    assert.equal(countOf(home, `ttq.load('${TIKTOK_ID}')`), 1);
    assert.equal(countOf(home, 'ttq.page()'), 1);
    assert.ok(home.indexOf('fbevents.js') < headEnd);
    assert.ok(home.indexOf('analytics.tiktok.com') < headEnd);
    assert.ok(home.indexOf('fbevents.js') < home.indexOf('analytics.tiktok.com'));
    assert.equal(countOf(home, 'id="otrace-ads"'), 1);
    assert.equal(adsConfig(home).product, null);
    assert.equal(adsConfig(home).purchase, null);
    assert.equal(adsConfig(home).ga, false);
    for (const event of ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'CompletePayment', 'view_item', 'add_to_cart', 'begin_checkout']) {
      assert.ok(home.includes(event), event);
    }
    assert.equal(countOf(home, 'googletagmanager.com/gtag'), 0);

    const { PRODUCTS } = await import('../catalog.js');
    const pdp = await theme.renderProduct(PRODUCTS['OT-HOOD']);
    const viewed = adsConfig(pdp).product;
    assert.deepEqual(viewed.content_ids, ['OT-HOOD']);
    assert.equal(viewed.content_type, 'product');
    assert.equal(viewed.value, 80);
    assert.equal(viewed.currency, 'USD');
    assert.equal(viewed.contents[0].item_price, 80);
    assert.equal(viewed.items[0].item_id, 'OT-HOOD');
    assert.equal(viewed.items[0].price, 80);

    const { standalonePage } = await import('./pages.js');
    const setPage = await theme.renderPage('page', standalonePage('complete-set'), 'page');
    const setView = adsConfig(setPage).product;
    assert.deepEqual(setView.content_ids, ['OT-HOOD', 'OT-PANT']);
    assert.equal(setView.value, 140);
    assert.equal(setView.currency, 'USD');

    process.env.GA_MEASUREMENT_ID = 'G-KZZXSSF3L1';
    const withGa = await theme.renderProduct(PRODUCTS['OT-PANT']);
    assert.equal(adsConfig(withGa).ga, true);
    assert.equal(adsConfig(withGa).product.content_ids[0], 'OT-PANT');
    assert.equal(adsConfig(withGa).product.value, 80);
    assert.equal(countOf(withGa, 'googletagmanager.com/gtag/js?id=G-KZZXSSF3L1'), 1);
    assert.ok(withGa.indexOf('googletagmanager.com/gtag/js') < withGa.indexOf('fbevents.js'));
    delete process.env.GA_MEASUREMENT_ID;

    const retrieved = [];
    const capiCalls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capiCalls.push({ url: String(url), body: JSON.parse(init.body) });
      return { ok: true, status: 200 };
    };
    process.env.META_CAPI_TOKEN = CAPI_TOKEN;
    resetCapiDedupe();
    const stripe = {
      checkout: {
        sessions: {
          async retrieve(id, opts) {
            retrieved.push({ id, opts });
            if (id === 'cs_test_missing01') throw new Error('No such checkout.session');
            if (id === 'cs_test_unpaid001') {
              return { id, payment_status: 'unpaid', amount_total: 8000, currency: 'usd', value: 1 };
            }
            return {
              id,
              payment_status: 'paid',
              amount_total: 14000,
              currency: 'usd',
              value: 1,
              customer_details: { email: 'buyer@example.com' },
              metadata: {
                items: JSON.stringify([
                  { s: 'OT-HOOD', z: 'M', c: 'Onyx Black', q: 1 },
                  { s: 'OT-PANT', z: 'M', c: 'Onyx Black', q: 1 },
                ]),
                items_parts: '1',
              },
            };
          },
        },
      },
    };
    const app = express();
    mountStorefront(app, {
      themeRenderer: theme,
      siteUrl: SITE,
      stripe,
      sendThemeHtml: (res, html) => {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      },
    });
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const get = (path) => new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${server.address().port}${path}`, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      }).on('error', reject);
    });
    try {
      const paid = await get('/order/success?session_id=cs_test_paidset01&value=1&currency=EUR&content_ids=FAKE');
      assert.equal(paid.status, 200);
      assert.match(paid.body, /Order confirmed/);
      const purchase = adsConfig(paid.body).purchase;
      assert.equal(purchase.value, 140);
      assert.equal(purchase.currency, 'USD');
      assert.deepEqual(purchase.content_ids, ['OT-HOOD', 'OT-PANT']);
      assert.equal(purchase.content_type, 'product');
      assert.equal(purchase.num_items, 2);
      assert.equal(purchase.transaction_id, 'cs_test_paidset01');
      assert.equal(purchase.event_id, 'purchase.cs_test_paidset01');
      assert.equal(purchase.items.reduce((sum, item) => sum + item.price * item.quantity, 0), 140);
      const paidJson = paid.body.match(/id="otrace-ads">([^<]*)/)[1];
      assert.doesNotMatch(paidJson, /"value":1[,}]/);
      assert.doesNotMatch(paidJson, /FAKE|EUR/);
      assert.equal(paid.body.includes('buyer@example.com'), false);
      assert.equal(paid.body.includes(CAPI_TOKEN), false);
      const storageAt = paid.body.indexOf('otrace-purchase:');
      const setAt = paid.body.indexOf('sessionStorage.setItem', storageAt);
      const fireAt = paid.body.indexOf("meta('Purchase'", setAt);
      assert.ok(storageAt > 0 && setAt > storageAt && fireAt > setAt);
      assert.equal(retrieved[0].id, 'cs_test_paidset01');
      assert.deepEqual(retrieved[0].opts, { expand: ['line_items.data.price.product'] });
      assert.equal(capiCalls.length, 1);
      assert.equal(capiCalls[0].body.data[0].event_id, 'purchase.cs_test_paidset01');
      assert.equal(capiCalls[0].body.data[0].custom_data.value, 140);
      assert.equal(capiCalls[0].body.data[0].custom_data.currency, 'USD');

      const unpaid = await get('/order/success?session_id=cs_test_unpaid001&value=999');
      assert.equal(adsConfig(unpaid.body).purchase, null);
      assert.doesNotMatch(unpaid.body.match(/id="otrace-ads">([^<]*)/)[1], /"value":999[,}]/);
      assert.equal(capiCalls.length, 1);

      const broken = await get('/order/success?session_id=cs_test_missing01&value=50');
      assert.equal(adsConfig(broken.body).purchase, null);
      assert.doesNotMatch(broken.body.match(/id="otrace-ads">([^<]*)/)[1], /"value":50[,}]/);
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  } finally {
    resetCapiDedupe();
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});

test('merchant feed is a Meta and TikTok catalog of XS–2XL variants', () => {
  const feed = merchantFeedXml(SITE);
  const ids = [...feed.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map((match) => match[1]);
  const links = [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map((match) => match[1]);
  const sizes = [...feed.matchAll(/<g:size>([^<]+)<\/g:size>/g)].map((match) => match[1]);
  const colors = [...feed.matchAll(/<g:color>([^<]+)<\/g:color>/g)].map((match) => match[1]);
  assert.equal(ids.length, 2 * 2 * SIZES.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(links).size, links.length);
  assert.deepEqual([...new Set(sizes)].sort(), [...SIZES].sort());
  assert.deepEqual([...new Set(colors)].sort(), ['Onyx Black', 'Warm Cream']);
  assert.equal(feed.match(/<g:brand>OTRACE<\/g:brand>/g).length, ids.length);
  assert.equal(feed.match(/<g:availability>in_stock<\/g:availability>/g).length, ids.length);
  assert.equal(feed.match(/<g:condition>new<\/g:condition>/g).length, ids.length);
  assert.equal(feed.match(/<g:price>80\.00 USD<\/g:price>/g).length, ids.length);
  assert.equal(feed.match(/<g:identifier_exists>no<\/g:identifier_exists>/g).length, ids.length);
  assert.match(feed, /<title>[^<]+<\/title>/);
  assert.match(feed, /<description>[^<]+<\/description>/);
  assert.match(feed, /<g:image_link>https:\/\/otrace\.co\/products\//);
  assert.match(feed, /<link>https:\/\/otrace\.co\/product\/oversized-hoodie\?variant=OT-HOOD-onyx-black-xs<\/link>/);
  assert.match(feed, /<link>https:\/\/otrace\.co\/product\/wide-leg-sweatpant\?variant=OT-PANT-warm-cream-2xl<\/link>/);
  assert.match(feed, /<g:item_group_id>OT-HOOD<\/g:item_group_id>/);
  assert.match(feed, /<g:item_group_id>OT-PANT<\/g:item_group_id>/);
  assert.doesNotMatch(feed, /3XL|4XL|\$100|140\.00 USD|OT-SET/);
  const served = publicBody('/merchant-feed.xml', SITE);
  assert.match(served.type, /xml/);
  assert.match(String(served.body), /<g:brand>OTRACE<\/g:brand>/);
});
});

/**
 * The Shopping feed is submission-ready and its titles can be matched.
 *
 * Validated against the live feed on 22 Nov 2026: 24 items, every required
 * field present, shipping correctly nested with free US delivery, and all 25
 * landing pages plus all 4 main images returning 200. Merchant Center would
 * accept it. The one thing it could not do was get FOUND: every title read
 * "Oversized Hoodie - Onyx Black - XS", because the feed used
 * productDisplayName, which strips the brand on purpose for on-site use.
 *
 * Google matches a Shopping query against the title before almost anything
 * else, so a title with no brand and no fabric is the whole ballgame.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCTS, SIZES } from '../catalog.js';
import { feedTitle, merchantFeedXml } from './discovery.js';

const feed = merchantFeedXml('https://otrace.co');
const titles = [...feed.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]).slice(1); // [0] is the channel

test('every feed title carries the brand, the fabric, the colour and the size', () => {
  assert.ok(titles.length >= 24, `only ${titles.length} item titles`);
  for (const t of titles) {
    assert.ok(t.startsWith('OTRACE '), `no brand: ${t}`);
    assert.match(t, /450 GSM/, `no fabric weight: ${t}`);
    assert.match(t, /Garment-Dyed/i, `no garment-dyed: ${t}`);
    assert.match(t, /(Onyx Black|Warm Cream)/, `no colourway: ${t}`);
    assert.match(t, /(XS|S|M|L|XL|2XL)$/, `no size at the end: ${t}`);
    // Google's limit. Nothing here should be close, but a longer product
    // name later could push a row over without anyone noticing.
    assert.ok(t.length <= 150, `${t.length} chars: ${t}`);
  }
});

test('titles are unique per variant, so Google does not collapse them', () => {
  assert.equal(new Set(titles).size, titles.length, 'two variants share a title');
});

test('the helper is what builds them, not a second format in the XML', () => {
  for (const product of Object.values(PRODUCTS)) {
    for (const colourway of product.colorways ?? []) {
      for (const size of (product.sizes ?? SIZES).filter((s) => SIZES.includes(s))) {
        assert.ok(titles.includes(feedTitle(product, colourway.name, size)),
          `${product.sku} ${colourway.name} ${size} is not in the feed as feedTitle builds it`);
      }
    }
  }
});

test('the feed still carries what Merchant Center requires', () => {
  const items = feed.split('<item>').slice(1);
  assert.equal(items.length, 24, `${items.length} items`);
  for (const item of items) {
    for (const tag of ['g:id', 'title', 'description', 'link', 'g:image_link',
      'g:availability', 'g:price', 'g:brand', 'g:condition', 'g:item_group_id']) {
      assert.match(item, new RegExp(`<${tag}>[^<]`), `missing or empty <${tag}>`);
    }
    // shipping is a NESTED group, so an empty <g:shipping> text node is
    // correct and only its children prove free US delivery is declared.
    assert.match(item, /<g:shipping>[\s\S]*?<g:country>US<\/g:country>[\s\S]*?<g:price>0\.00 USD<\/g:price>[\s\S]*?<\/g:shipping>/,
      'free US shipping is not declared in the shipping group');
    assert.match(item, /<link>https:\/\/otrace\.co\/product\/[a-z-]+\?variant=/, 'bad landing link');
  }
});

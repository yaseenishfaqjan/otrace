/**
 * Search finds what a shopper types.
 *
 * Measured against the LIVE site on 22 Nov 2026, before this: eleven of
 * fourteen realistic queries returned "No matches", including `hoodies` and
 * `sweatpants` - the plurals of the only two products - and `wide leg`,
 * which is inside a product's own name. The matcher was
 * `label.toLowerCase().includes(query)` over three hard-coded titles.
 *
 * The list below is that measurement, kept as the test. It is deliberately
 * written as words rather than as a keyword dump: each one is a thing
 * somebody would type into a two-product streetwear shop.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCTS } from '../catalog.js';
import { buildIndex, searchProducts, stem, words } from './search.js';

const labels = (q) => searchProducts(q).map((e) => e.label);

test('the eleven queries that used to return nothing now return something', () => {
  const dead = [
    'hoodies', 'sweatpants', 'joggers', 'wide leg', '450 gsm',
    'fleece', 'hoody', 'tracksuit', 'warm cream', 'onyx', 'bottoms',
  ];
  for (const q of dead) {
    assert.ok(labels(q).length > 0, `"${q}" still returns nothing`);
  }
});

test('singular and plural find the same thing', () => {
  for (const [one, many] of [['hoodie', 'hoodies'], ['sweatpant', 'sweatpants'], ['jogger', 'joggers']]) {
    assert.deepEqual(labels(one), labels(many), `${one} / ${many} disagree`);
  }
});

test('a query narrows rather than widening', () => {
  // Every entry carries the shared fabric words and both colourways, so an
  // ANY-token match returns the whole catalogue for a two-word query and
  // reads as if search were ignoring half of what you typed.
  //
  // "onyx joggers" is the discriminator: the hoodie HAS onyx and has not got
  // jogger, so ALL-tokens drops it and ANY-token keeps it. A single-token
  // query cannot tell the two apart, which is why the first version of this
  // test used one and stayed green when `every` was changed to `some`.
  assert.deepEqual(labels('onyx joggers'), ['Wide-Leg Sweatpant']);
  assert.deepEqual(labels('450 joggers'), ['Wide-Leg Sweatpant']);
  assert.equal(labels('warm cream hoodie')[0], 'Oversized Hoodie');
  assert.ok(!labels('joggers').includes('Oversized Hoodie'), 'joggers matched the hoodie');
  assert.ok(!labels('hoody').includes('Wide-Leg Sweatpant'), 'hoody matched the sweatpant');
});

test('a partial word still finds things, because people stop typing', () => {
  // Prefix matching, not equality. Someone types "garm" or "overs" into a
  // live dropdown before they have finished the word; equality returns
  // nothing for both and the suggest panel looks broken mid-keystroke.
  assert.equal(labels('garm').length, 3, '"garm" found nothing');
  assert.equal(labels('overs')[0], 'Oversized Hoodie');
  assert.ok(labels('sweat').includes('Wide-Leg Sweatpant'), '"sweat" missed the sweatpant');
});

test('the garment you named ranks above the set that contains it', () => {
  assert.equal(labels('hoodie')[0], 'Oversized Hoodie');
  assert.equal(labels('sweatpant')[0], 'Wide-Leg Sweatpant');
  assert.equal(labels('tracksuit')[0], 'Complete Set');
});

test('nonsense returns nothing, and an empty query returns everything', () => {
  for (const q of ['zzz', 'qwertyuiop', 'ferrari']) {
    assert.deepEqual(labels(q), [], `"${q}" matched something`);
  }
  assert.equal(searchProducts('').length, buildIndex().length);
  assert.equal(searchProducts('   ').length, buildIndex().length);
});

test('the index is built from the catalogue, not a copied keyword list', () => {
  // Rename a product and the old name must stop matching - that is what a
  // hand-written list cannot do.
  const renamed = {
    'OT-HOOD': { ...PRODUCTS['OT-HOOD'], name: 'OTRACE Cropped Anorak', seoTitle: 'Cropped Anorak', slug: 'cropped-anorak', description: 'An anorak.' },
  };
  const found = searchProducts('anorak', renamed).map((e) => e.label);
  assert.ok(found.includes('Cropped Anorak'), 'a renamed product is not findable by its new name');
  assert.equal(searchProducts('oversized', renamed).filter((e) => e.label === 'Oversized Hoodie').length, 0);
});

test('every real product is reachable, and every hit has a live href', () => {
  const index = buildIndex();
  for (const product of Object.values(PRODUCTS)) {
    assert.ok(index.some((e) => e.product === product), `${product.sku} is not in the index`);
    assert.ok(labels(product.name).includes(product.name.replace(/^OTRACE\s+/, '')),
      `${product.name} does not find itself`);
  }
  for (const entry of index) {
    assert.match(entry.href, /^\/product\/[a-z0-9-]+$/, `bad href ${entry.href}`);
    assert.ok(entry.label && !entry.label.startsWith('OTRACE '), `bad label ${entry.label}`);
  }
});

test('stemming keeps short words whole', () => {
  // gsm and set must survive; hoodies and bottoms must not.
  assert.equal(stem('gsm'), 'gsm');
  assert.equal(stem('set'), 'set');
  assert.equal(stem('xs'), 'xs');
  assert.equal(stem('hoodies'), 'hoodie');
  assert.equal(stem('bottoms'), 'bottom');
  assert.equal(stem('dress'), 'dress');
  assert.deepEqual(words('Wide-Leg Sweatpant'), ['wide', 'leg', 'sweatpant']);
});

test('a size in the index cannot swallow a long query', () => {
  // The index carries SIZES so "xl" is not a dead end. That added the
  // one-letter tokens s, m and l - and the token-is-a-prefix-of-query
  // direction then made EVERY query starting with those letters match EVERY
  // product. Measured live: "sweatpant" returned the hoodie.
  assert.deepEqual(labels('sweatpant'), ['Wide-Leg Sweatpant', 'Complete Set']);
  assert.deepEqual(labels('sweatpants'), ['Wide-Leg Sweatpant', 'Complete Set']);
  assert.deepEqual(labels('set'), ['Complete Set']);
  assert.ok(!labels('logo').includes('Oversized Hoodie'), '"logo" matched via the L size');

  // ...while the sizes themselves still work, which is why they are indexed.
  const xl = labels('xl');
  assert.ok(xl.includes('Oversized Hoodie') && xl.includes('Wide-Leg Sweatpant'), 'xl lost the garments');
});

test('the results page canonicals to /shop and says noindex in the markup too', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const { fileURLToPath } = await import('node:url');
  const theme = createThemeRenderer({
    themeRoot: fileURLToPath(new URL('../../theme', import.meta.url)),
    siteUrl: 'https://otrace.co',
    assetBase: '/api/theme-assets',
    routesRoot: '/',
  });
  const html = await theme.renderCollection({
    handle: 'search',
    title: 'Results for “sweatpants”',
    description: 'x',
    products: [PRODUCTS['OT-PANT']],
    canonicalPath: '/shop',
    noindex: true,
  });
  // /shop/search does not exist. A canonical pointing at a 404 is worse than
  // no canonical at all.
  assert.match(html, /rel="canonical"[^>]*href="https:\/\/otrace\.co\/shop"/);
  assert.doesNotMatch(html, /canonical[^>]*\/shop\/search/);
  // The HTML said `index, follow` while the response header said noindex.
  // The restrictive one wins so it worked, but the two must not disagree.
  assert.match(html, /name="robots"[^>]*content="[^"]*noindex/);
  assert.doesNotMatch(html, /name="robots"[^>]*content="index/);

  // A real collection is unaffected.
  const shop = await theme.renderCollection({
    handle: 'all', title: 'AW2026', description: 'x', products: [PRODUCTS['OT-PANT']],
  });
  assert.match(shop, /rel="canonical"[^>]*href="https:\/\/otrace\.co\/shop"/);
  assert.match(shop, /name="robots"[^>]*content="index/);
});

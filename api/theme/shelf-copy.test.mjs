/**
 * The shelf pages and the lookbook say something of their own.
 *
 * Measured against the live site on 22 Nov 2026, before this:
 *
 *   /shop/hoodies   125 lines of text
 *   /shop/bottoms   125 lines of text
 *   differing by    4  - the names on the product cards
 *
 * Two indexable URLs saying the same thing, competing with /shop and with
 * each other. /lookbook was thinner again: 200 words including nav and
 * footer, one sentence of which was its own, a 24-character title and a
 * 76-character description - on the page where somebody is already looking
 * at the clothes and has nowhere to click.
 *
 * The copy is composed FROM the catalogue, so a price or a size cannot
 * drift away from it. That is not hypothetical here: /garment-dyed sat on
 * the live host quoting retired prices for weeks.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, SET_TOTAL_CENTS, SIZES, formatMoney } from '../catalog.js';
import { collectionBody, lookCaption, lookbookIntro } from './collection-copy.js';
import { createThemeRenderer } from './render-page.js';
import { PAGES, pageContent } from './pages.js';

const theme = createThemeRenderer({
  themeRoot: fileURLToPath(new URL('../../theme', import.meta.url)),
  siteUrl: 'https://otrace.co',
  assetBase: '/api/theme-assets',
  routesRoot: '/',
});

const strip = (html) =>
  String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sentences = (html) =>
  new Set(strip(html).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12));

const shelf = (handle, title, products) =>
  theme.renderCollection({
    handle, title, description: 'meta', bodyHtml: collectionBody(handle), products,
  });

test('the two shelves are not near-duplicates of each other', async () => {
  const hoodies = await shelf('hoodies', 'Hoodies', [PRODUCTS['OT-HOOD']]);
  const bottoms = await shelf('bottoms', 'Bottoms', [PRODUCTS['OT-PANT']]);
  const a = sentences(hoodies);
  const b = sentences(bottoms);
  const onlyA = [...a].filter((s) => !b.has(s));
  const onlyB = [...b].filter((s) => !a.has(s));
  // Was 2 each, and both of those were a product card's name.
  assert.ok(onlyA.length >= 5, `/shop/hoodies has only ${onlyA.length} sentences of its own`);
  assert.ok(onlyB.length >= 5, `/shop/bottoms has only ${onlyB.length} sentences of its own`);

  // They must not merely differ - each has to lead with ITS garment.
  assert.match(strip(collectionBody('hoodies')).slice(0, 80), /Oversized Hoodie/);
  assert.match(strip(collectionBody('bottoms')).slice(0, 80), /Wide-Leg Sweatpant/);
});

test('shelf copy is rendered as markup, once, and not into the meta description', async () => {
  const html = await shelf('hoodies', 'Hoodies', [PRODUCTS['OT-HOOD']]);
  assert.equal((html.match(/hdt-shelf-specs/g) || []).length, 1, 'spec list missing or duplicated');
  // If `show_description` is turned back off the copy silently disappears
  // and only this assertion notices - npm run build stays green either way.
  assert.ok(html.includes('cut a full size large'), 'the body copy is not on the page');
  assert.ok(!html.includes('&lt;p&gt;'), 'the copy was HTML-escaped');
  const meta = (html.match(/name="description" content="([^"]*)"/) || [])[1] ?? '';
  assert.equal(meta, 'meta', 'body HTML leaked into the meta description');
  assert.ok(!/[<>]/.test(meta), 'meta description contains markup');
});

test('every number in the shelf copy comes from the catalogue', () => {
  const all = ['all', 'hoodies', 'bottoms'].map(collectionBody).join(' ');
  assert.ok(all.includes(formatMoney(PRODUCTS['OT-HOOD'].priceCents)), 'single price missing');
  assert.ok(all.includes(formatMoney(SET_TOTAL_CENTS)), 'set price missing');
  assert.ok(all.includes(`${SIZES[0]} to ${SIZES[SIZES.length - 1]}`), 'size range missing');
  // A price written as a literal is the thing this guards against.
  for (const stale of ['$148', '$128', '$99', '$100']) {
    assert.ok(!all.includes(stale), `a hard-coded ${stale} is in the shelf copy`);
  }
});

test('the lookbook links to what it is showing', async () => {
  const html = await theme.renderPage('page', pageContent('lookbook'), 'page');
  const words = strip(html.split('</head>')[1] ?? '').split(' ').length;
  assert.ok(words > 300, `lookbook body is ${words} words`);
  assert.equal((html.match(/<figcaption>/g) || []).length, 8, 'a frame lost its caption');
  assert.ok((html.match(/href="\/product\/(oversized-hoodie|wide-leg-sweatpant)"/g) || []).length >= 8,
    'the lookbook does not link to the products it shows');

  // The caption is not the alt text. If they are the same string a screen
  // reader reads the sentence twice for every frame.
  for (const [src, caption] of Object.entries({ '/lookbook/look-06.jpg': lookCaption('/lookbook/look-06.jpg') })) {
    const alt = (html.match(new RegExp(`src="${src.replace(/[/.]/g, '\\$&')}"[^>]*alt="([^"]*)"`)) || [])[1];
    assert.ok(alt, `no alt for ${src}`);
    assert.notEqual(strip(caption), alt, 'caption duplicates the alt text');
  }
});

test('the lookbook intro names the pieces and the price', () => {
  const intro = strip(lookbookIntro());
  assert.match(intro, /hoodie/i);
  assert.match(intro, /sweatpant/i);
  assert.ok(intro.includes(formatMoney(PRODUCTS['OT-HOOD'].priceCents)), 'no single price');
  assert.ok(intro.includes(formatMoney(SET_TOTAL_CENTS)), 'no set price');
});

test('no page description runs past 160 characters', () => {
  // The lookbook rewrite landed at 180 on the first attempt and nothing
  // caught it, because the existing length check only walked the journal.
  for (const handle of Object.keys(PAGES)) {
    const page = pageContent(handle);
    if (!page?.page_description) continue;
    assert.ok(page.page_description.length <= 160,
      `/${handle} description is ${page.page_description.length}`);
    // The RENDERED title, not page_title. render-page appends " — OTRACE"
    // to any title that does not already name the brand, so measuring
    // page_title passes a 58 that Google receives as 67 - which is exactly
    // what the first version of this check did to the lookbook.
    const rendered = page.page_title.includes('OTRACE')
      ? page.page_title
      : `${page.page_title} — OTRACE`;
    assert.ok(rendered.length <= 60, `/${handle} renders a ${rendered.length}-char title: ${rendered}`);
  }
});

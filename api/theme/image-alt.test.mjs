/**
 * Every <img> the theme renders carries an alt, and none carries src="".
 *
 * Bing Webmaster Tools' Site Scan reported missing alt attributes across the
 * site. Measured against the live pages on 15 Nov 2026: 158 images on 20
 * pages. Three causes, and only the third was what it looked like.
 *
 * 1. `image_tag` emitted <img src=""> for a nil image. Shopify renders
 *    nothing at all. The mega menu has two collection blocks with no image
 *    set, so every page carried two of these - and an empty src makes the
 *    browser re-request the current page as an image, which is worse than
 *    the missing alt that surfaced it.
 *
 * 2. `image_url` hands `image_tag` a bare string, so the alt on the image
 *    object was gone before the tag was built. The alt text was never
 *    missing: shared/product-media.json has a written line for every photo.
 *    It was being dropped in the filter chain.
 *
 * 3. blocks/_product-trust-badge.liquid had no alt on the payment icons,
 *    where its two siblings (cart-drawer, main-cart) both do.
 *
 * alt="" is a correct value for a decorative image and is NOT the same as
 * the attribute being absent - so this file also checks that the product
 * photos keep their real descriptions, or "fix" everything with alt=""
 * would pass.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS } from '../catalog.js';
import { createThemeRenderer } from './render-page.js';

const theme = createThemeRenderer({
  themeRoot: fileURLToPath(new URL('../../theme', import.meta.url)),
  siteUrl: 'https://otrace.co',
  assetBase: '/api/theme-assets',
  routesRoot: '/',
});

const imgs = (html) => html.match(/<img[^>]*>/g) || [];

let pages;
const rendered = async () => {
  if (!pages) {
    pages = {
      home: await theme.renderPage('index', {
        title: 'OTRACE', page_title: 'OTRACE', canonical_path: '/',
      }, 'index'),
      hoodie: await theme.renderProduct(PRODUCTS['OT-HOOD']),
      pant: await theme.renderProduct(PRODUCTS['OT-PANT']),
    };
  }
  return pages;
};

test('no rendered image is missing its alt attribute', async () => {
  for (const [name, html] of Object.entries(await rendered())) {
    const bare = imgs(html).filter((tag) => !/\salt=/.test(tag));
    assert.deepEqual(
      bare.map((t) => t.slice(0, 120)), [],
      `${name} has ${bare.length} <img> with no alt`,
    );
    assert.ok(imgs(html).length > 0, `${name} rendered no images at all`);
  }
});

test('no rendered image has an empty src', async () => {
  for (const [name, html] of Object.entries(await rendered())) {
    const blank = imgs(html).filter((tag) => /\ssrc=""/.test(tag));
    assert.deepEqual(blank.map((t) => t.slice(0, 120)), [], `${name} has src=""`);
  }
});

/**
 * The catalogue's own alt text reaches the page. Without this, alt="" on
 * every image would satisfy the two checks above while telling a reader
 * using a screen reader, and a search engine, nothing at all.
 */
test('product photos keep the alt text written for them in the catalogue', async () => {
  const { hoodie, pant } = await rendered();
  const cases = [
    [hoodie, 'OTRACE oversized hoodie in Onyx Black, front'],
    [hoodie, 'Model wearing the OTRACE oversized hoodie in Onyx Black'],
    [pant, 'OTRACE wide-leg sweatpant in Onyx Black, front'],
    [pant, 'Model wearing the OTRACE wide-leg sweatpant in Onyx Black'],
  ];
  for (const [html, alt] of cases) {
    assert.ok(html.includes(`alt="${alt}"`), `no image carries alt="${alt}"`);
  }
  // Enough of the page is described, not just the four checked above.
  for (const [name, html] of Object.entries({ hoodie, pant })) {
    const described = imgs(html).filter((t) => /\salt="[^"]+"/.test(t)).length;
    assert.ok(described >= 10, `${name} describes only ${described} images`);
  }
});

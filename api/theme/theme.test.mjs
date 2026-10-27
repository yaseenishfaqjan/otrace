import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createCheckoutSession } from '../checkout-session.js';
import { PRODUCTS, SET_TOTAL_CENTS } from '../catalog.js';
import { addLine, cartJson, changeLine, decodeVariantId } from './cart.js';
import { parseFormBody } from './form-body.js';
import { parseThemeJson, resolveLinkListSettings, stripJsonComments } from './liquid-engine.js';
import { resolveThemeProductSettings, selectShopifyVariant, themeSettings, toShopifyProduct } from './shopify-shape.js';

const SITE = 'https://otrace.co';

/* ---- the checkout both storefronts share ---- */

/**
 * A fake Stripe that records what it was asked to create.
 *
 * The point of these tests is that the React storefront and the Kalles theme
 * must produce the SAME session, because they now call one function. A second
 * copy would drift silently: nothing fails when one of them is wrong, a
 * customer is simply charged or shipped differently depending on which page
 * they started from.
 */
const fakeStripe = () => {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        create: async (args) => {
          calls.push(args);
          return {
            id: 'cs_test_1',
            url: 'https://checkout.stripe.test/cs_test_1',
            amount_total: 0,
          };
        },
      },
    },
  };
};

test('checkout refuses when Stripe is not configured, in words fit to show a customer', async () => {
  const { error, status, session } = await createCheckoutSession(null, [], { siteUrl: SITE });
  assert.equal(status, 503);
  assert.equal(session, undefined);
  assert.match(error, /not configured/i);
  assert.doesNotMatch(error, /stripe/i, 'a customer-facing message must not name our provider');
});

test('checkout refuses an empty basket', async () => {
  const { error, status } = await createCheckoutSession(fakeStripe(), [], { siteUrl: SITE });
  assert.equal(status, 400);
  assert.match(error, /empty/i);
});

test('checkout refuses a basket we do not sell, and opens no session for it', async () => {
  const stripe = fakeStripe();
  const { error } = await createCheckoutSession(
    stripe,
    [{ sku: 'NOT-OURS', colour: 'Onyx Black', size: 'M', quantity: 1 }],
    { siteUrl: SITE },
  );
  assert.ok(error);
  assert.equal(stripe.calls.length, 0);
});

test('both storefronts produce the same session for the same basket', async () => {
  const stripe = fakeStripe();
  await createCheckoutSession(
    stripe,
    [
      { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'XL', quantity: 1 },
      { sku: 'OT-PANT', colour: 'Warm Cream', size: 'M', quantity: 1 },
    ],
    { siteUrl: SITE },
  );
  const [args] = stripe.calls;

  assert.equal(args.mode, 'payment');
  assert.match(args.success_url, /^https:\/\/otrace\.co\/order\/success/);
  assert.equal(args.billing_address_collection, 'required');
  const countries = args.shipping_address_collection.allowed_countries;
  assert.ok(countries.includes('US'));
  assert.ok(countries.includes('GB'), 'a UK address has to be accepted');
  assert.ok(countries.length > 10);
  assert.equal(args.shipping_options[0].shipping_rate_data.display_name, 'Free delivery — United States');
  assert.equal(args.shipping_options[0].shipping_rate_data.fixed_amount.amount, 0);
  assert.match(args.custom_text.shipping_address.message, /United States/);
  assert.match(args.custom_text.shipping_address.message, /worldwide/i);
  assert.doesNotMatch(args.custom_text.shipping_address.message, /free worldwide/i);

  // One hoodie with one sweatpant is the set, and the set is the whole offer.
  const total = args.line_items.reduce(
    (sum, i) => sum + i.price_data.unit_amount * i.quantity,
    0,
  );
  assert.equal(total, SET_TOTAL_CENTS);

  // Stripe caps a metadata value at 500 characters; packItems exists for that.
  for (const [key, value] of Object.entries(args.metadata)) {
    assert.ok(String(value).length <= 500, `metadata.${key} is over Stripe's limit`);
  }
});

/* ---- the cart the theme talks to ---- */

test('a variant id decodes back to a real product, and rubbish does not', () => {
  assert.deepEqual(decodeVariantId('OT-HOOD-onyx-black-2xl'), {
    sku: 'OT-HOOD',
    colour: 'Onyx Black',
    size: '2XL',
  });
  for (const bad of ['OT-HOOD-no-such-colour-xl', 'OT-HOOD-onyx-black-xxxl', 'nonsense', '', null]) {
    assert.equal(decodeVariantId(bad), null, `${bad} must not decode`);
  }
});

test('the cart groups the price bands back into the lines the customer added', () => {
  const cart = cartJson(
    [
      { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'XL', quantity: 2 },
      { sku: 'OT-PANT', colour: 'Warm Cream', size: 'M', quantity: 1 },
    ],
    { siteUrl: SITE },
  );

  // buildLineItems returns three rows here - one hoodie at the set rate, one at
  // the single rate, one sweatpant - which is right for Stripe and wrong for a
  // drawer that would then show three lines for two things added.
  assert.equal(cart.items.length, 2);
  assert.equal(cart.item_count, 3);
  assert.equal(cart.total_price, SET_TOTAL_CENTS + PRODUCTS['OT-HOOD'].priceCents);
  assert.equal(cart.total_discount, cart.original_total_price - cart.total_price);

  const discounted = cart.items.filter((i) => i.line_level_discount_allocations.length);
  assert.ok(discounted.length, 'the set saving must be visible on the line');
});

test('a cart line carries what Liquid reads, not only what the JSON needs', () => {
  const [item] = cartJson(
    [{ sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M', quantity: 1 }],
    { siteUrl: SITE },
  ).items;

  // The cart template prints item.product.title. Without the nested product the
  // row renders blank and unclickable while the price and image look fine.
  assert.equal(item.product.title, PRODUCTS['OT-HOOD'].name);
  assert.ok(item.variant, 'the template reads item.variant for the quantity rules');
  assert.ok(item.featured_image?.src, 'a line with no image is a broken row');
});

test('adding merges an existing line, and changing to zero removes it', () => {
  let lines = addLine([], { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M', quantity: 1 });
  lines = addLine(lines, { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M', quantity: 2 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);

  lines = changeLine(lines, 'OT-HOOD-onyx-black-m', 0);
  assert.equal(lines.length, 0);
});

/* ---- the parsing the theme depends on ---- */

test('a cart POST is read from multipart, urlencoded and JSON alike', () => {
  const b = '----B';
  const multipart = [
    `--${b}`,
    'Content-Disposition: form-data; name="id"',
    '',
    'OT-HOOD-onyx-black-xl',
    `--${b}`,
    'Content-Disposition: form-data; name="quantity"',
    '',
    '2',
    `--${b}--`,
    '',
  ].join('\r\n');

  // The theme submits with new FormData(form), so a JSON-only reader rejects
  // every real add-to-cart while the same request as JSON works perfectly.
  assert.deepEqual(parseFormBody(multipart, `multipart/form-data; boundary=${b}`), {
    id: 'OT-HOOD-onyx-black-xl',
    quantity: '2',
  });
  assert.deepEqual(parseFormBody('id=x&quantity=1', 'application/x-www-form-urlencoded'), {
    id: 'x',
    quantity: '1',
  });
  assert.deepEqual(parseFormBody('{"id":"x"}', 'application/json'), { id: 'x' });
  assert.deepEqual(parseFormBody('not json at all', 'application/json'), {});
});

test('stripping JSONC comments leaves URLs intact', () => {
  // A regex strip truncates any string containing a double slash, and
  // everything after it on that line.
  assert.deepEqual(parseThemeJson('{"u": "https://a.com/x"} // trailing'), {
    u: 'https://a.com/x',
  });
  assert.deepEqual(parseThemeJson('{"a": 1,}'), { a: 1 });
  assert.equal(stripJsonComments('"//not a comment"').trim(), '"//not a comment"');
});

/* ---- settings, where an empty value is never harmless ---- */

test('settings fall back to the schema, and a select with no default takes its first option', () => {
  const out = resolveLinkListSettings(
    {
      settings: [
        { id: 'kept', type: 'text', default: 'from schema' },
        { id: 'overridden', type: 'text', default: 'from schema' },
        { id: 'ani', type: 'select', options: [{ value: 'none' }, { value: 'bounce' }] },
        { id: 'menu', type: 'link_list' },
      ],
    },
    { overridden: 'from the template', menu: 'main-menu' },
    { 'main-menu': { title: 'Main menu' } },
  );

  assert.equal(out.kept, 'from schema');
  assert.equal(out.overridden, 'from the template');
  // An undefined animation became classList.add('') inside a setInterval: an
  // exception every tick, which starved the rest of the page's JS.
  assert.equal(out.ani, 'none');
  // A link_list is stored as a handle and must resolve to the menu, or the
  // header prints its empty-menu notice and nothing else explains why.
  assert.deepEqual(out.menu, { title: 'Main menu' });
});

test('an unknown menu handle resolves to null, not to the handle string', () => {
  const out = resolveLinkListSettings(
    { settings: [{ id: 'menu', type: 'link_list' }] },
    { menu: 'no-such-menu' },
    {},
  );
  assert.equal(out.menu, null);
});

test('theme settings prefer what was saved over the schema default', () => {
  const merged = themeSettings({ current: { colour: 'saved' } }, [
    { settings: [{ id: 'colour', default: 'schema' }, { id: 'other', default: 'schema' }] },
  ]);
  assert.equal(merged.colour, 'saved');
  assert.equal(merged.other, 'schema');
});

/* ---- the product shape the theme renders ---- */

test('every product image carries dimensions and alt text', () => {
  for (const product of Object.values(PRODUCTS)) {
    const shaped = toShopifyProduct(product, { siteUrl: SITE });
    assert.ok(shaped.images.length, `${product.sku} has no photography`);
    for (const image of shaped.images) {
      // The theme sizes each media slot from the aspect ratio, so an image with
      // no dimensions is present, fetched over the network, and invisible.
      assert.ok(image.width > 0 && image.height > 0, `${image.src} has no dimensions`);
      assert.ok(image.alt, `${image.src} has no alt text`);
    }
  }
});

test('the shaped product prices the offer the way the page states it', () => {
  const product = PRODUCTS['OT-HOOD'];
  const shaped = toShopifyProduct(product, { siteUrl: SITE });
  assert.equal(shaped.price, product.priceCents);
  assert.equal(shaped.compare_at_price, product.listPriceCents);
  assert.ok(shaped.compare_at_price > shaped.price, 'the strike-through must be the higher number');
  assert.equal(shaped.price, 8000);
  assert.equal(shaped.compare_at_price, 10000);
  assert.equal(shaped.options_with_values[1].values[0].available, true);
  assert.equal(String(shaped.options_with_values[1].values[0]), product.sizes[0]);
  assert.equal(shaped.variants.length, product.sizes.length * product.colours.length);
});

test('each colour owns its own photos, and the product page leads with the sharpest', () => {
  for (const [sku, featured] of [
    ['OT-HOOD', { 'Onyx Black': 'hoodie-onyx-worn-front.jpg', 'Warm Cream': 'hoodie-cream-worn-front.jpg' }],
    ['OT-PANT', { 'Onyx Black': 'pant-onyx-worn.jpg', 'Warm Cream': 'pant-cream-worn.jpg' }],
  ]) {
    const product = PRODUCTS[sku];
    const shaped = toShopifyProduct(product, { siteUrl: SITE, featureSharpest: true });
    assert.equal(JSON.stringify(shaped.variants) && true, true, `${sku} variant JSON must not cycle`);
    const group = shaped.metafields.theme.group_media_obj.value;
    assert.equal(group.length, shaped.media.length, `${sku} groups every frame`);

    for (const [colour, file] of Object.entries(featured)) {
      const variant = shaped.variants.find((v) => v.option1 === colour && v.option2 === 'S');
      assert.match(variant.featured_media.src, new RegExp(file));
      assert.match(variant.featured_image.src, new RegExp(file));
      assert.equal(variant.featured_media.id, variant.featured_image.id);
      const colourIndex = product.colours.indexOf(colour);
      const ids = new Set(group.filter((row) => row.value === colourIndex).map((row) => row.mid));
      const shots = shaped.media.filter((item) => ids.has(item.id));
      assert.ok(shots.length >= 3, `${sku} ${colour} should keep its gallery`);
      assert.ok(shots.every((item) => item.src.includes(colour === 'Onyx Black' ? 'onyx' : 'cream')));
      assert.ok(shots.every((item) => !item.src.includes(colour === 'Onyx Black' ? 'cream' : 'onyx')));
      // The soft flat stays in the gallery; it is just not the frame the swatch opens on.
      const soft = sku === 'OT-HOOD'
        ? (colour === 'Onyx Black' ? 'hoodie-onyx-back.jpg' : 'hoodie-cream-back.jpg')
        : (colour === 'Onyx Black' ? 'pant-onyx-back.jpg' : 'pant-cream-back.jpg');
      assert.ok(shots.some((item) => item.src.includes(soft)), `${soft} was dropped`);
    }
  }

  // Shop cards are one colour and keep the logo flat as the card image.
  const onyx = PRODUCTS['OT-HOOD'].colorways[0];
  const card = toShopifyProduct(
    { ...PRODUCTS['OT-HOOD'], images: onyx.images, colours: [onyx.name] },
    { siteUrl: SITE },
  );
  assert.match(card.featured_media.src, /hoodie-onyx-front\.jpg/);
  assert.match(card.media[1].src, /hoodie-onyx-back\.jpg/);

  const cream = selectShopifyVariant(
    toShopifyProduct(PRODUCTS['OT-HOOD'], { siteUrl: SITE, featureSharpest: true }),
    'OT-HOOD-warm-cream-xs',
  );
  assert.equal(cream.selected_or_first_available_variant.id, 'OT-HOOD-warm-cream-xs');
  assert.match(cream.media[0].src, /hoodie-cream-worn-front\.jpg/);
  assert.match(cream.featured_media.src, /hoodie-cream/);
});

test('demo product handles do not survive as suggestion cards', () => {
  const schema = [{
    settings: [
      { id: 'products_suggest', type: 'product_list' },
      { id: 'free_ship_pr', type: 'product' },
    ],
  }];
  const settings = themeSettings({
    current: {
      products_suggest: ['ribbed-tank-top', 'oversized-hoodie'],
      free_ship_pr: 'gift-wrap',
    },
  }, schema);
  const hoodie = toShopifyProduct(PRODUCTS['OT-HOOD'], { siteUrl: SITE });
  resolveThemeProductSettings(settings, schema, { 'oversized-hoodie': hoodie });
  assert.equal(settings.products_suggest.length, 1);
  assert.equal(settings.products_suggest[0].title, hoodie.title);
  assert.equal(settings.free_ship_pr, null);

  const empty = { products_suggest: ['no-such-product'] };
  resolveThemeProductSettings(empty, schema, {});
  // null, not [], because LiquidJS treats an empty array as truthy.
  assert.equal(empty.products_suggest, null);
});

test('the shop lists the four colourways and no placeholder price', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const renderer = createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  const shop = await renderer.renderCollection({
    handle: 'all',
    title: 'AW2026',
    products: Object.values(PRODUCTS),
  });
  const home = await renderer.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
  for (const html of [shop, home]) {
    assert.equal(html.includes('19.99'), false);
    assert.equal(html.includes('href="" class="hdt-card-product__title"'), false);
  }
  for (const title of [
    'Oversized Hoodie — Onyx Black',
    'Oversized Hoodie — Warm Cream',
    'Wide-Leg Sweatpant — Onyx Black',
    'Wide-Leg Sweatpant — Warm Cream',
  ]) {
    assert.ok(shop.includes(title), title);
  }
  assert.ok(shop.includes('$80.00'));
  assert.ok(shop.includes('$100.00'));
  assert.ok(home.includes('$140'));
});

test('quick view and quick add sit on a paper chip, and the prices stay', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const renderer = createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  const shop = await renderer.renderCollection({
    handle: 'all',
    title: 'AW2026',
    products: Object.values(PRODUCTS),
  });
  const home = await renderer.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
  for (const html of [shop, home]) {
    assert.match(html, /Quick view/);
    assert.match(html, /Quick add/);
    assert.match(html, /#f4f1eb/);
    assert.match(html, /#161513/);
  }
  assert.match(shop, /\$80\.00/);
  assert.match(shop, /\$100\.00/);
  assert.doesNotMatch(shop, /\$148/);
  assert.doesNotMatch(shop, /\$128/);
  assert.match(home, /\$140/);
});

test('homepage and shop do not show the flagged stairs or cream-logo frames', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const renderer = createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  const home = await renderer.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
  const shop = await renderer.renderCollection({
    handle: 'all',
    title: 'AW2026',
    products: Object.values(PRODUCTS),
  });
  const hoodie = await renderer.renderProduct(PRODUCTS['OT-HOOD']);
  for (const html of [home, shop]) {
    assert.equal(html.includes('/lookbook/look-02.jpg'), false);
    assert.equal(html.includes('/lookbook/look-05.jpg'), false);
  }
  assert.ok(home.includes('/products/hoodie-onyx-front.jpg'));
  assert.ok(home.includes('/products/pant-onyx-front.jpg'));
  assert.ok(home.includes('/products/hoodie-onyx-back.jpg'));
  assert.ok(home.includes('HOODIES'));
  assert.ok(home.includes('Both colourways'));
  assert.match(home, /#banner_VyWanM \.hdt-heading-block[\s\S]*color:\s*#161513/);
  assert.ok(home.includes('$80.00'));
  assert.ok(home.includes('$100.00'));
  assert.ok(home.includes('$140'));
  // THE COLLECTION pair is one Onyx card and one Warm Cream card. The
  // HOODIES / BOTTOMS frames are the other way around, so both colourways
  // are in the large frames. These are the soft flats, not the flagged
  // lookbook crops.
  const collection = sectionHtml(home, 'featured_collection_PTq36A');
  assert.ok(collection.includes('/products/hoodie-onyx-front.jpg'));
  assert.ok(collection.includes('/products/pant-cream-front.jpg'));
  assert.match(collection, /<span percent>20<\/span>%/);
  assert.ok(collection.includes('$80.00'));
  assert.ok(collection.includes('$100.00'));
  assert.equal(collection.includes('/products/hoodie-cream-front.jpg'), false);
  assert.equal(collection.includes('/products/pant-onyx-front.jpg'), false);
  const banners = sectionHtml(home, 'banner_VyWanM');
  assert.ok(banners.includes('/products/hoodie-cream-front.jpg'));
  assert.ok(banners.includes('/products/pant-onyx-front.jpg'));
  assert.equal(banners.includes('/products/hoodie-onyx-front.jpg'), false);
  assert.equal(banners.includes('/lookbook/look-02.jpg'), false);
  assert.equal(banners.includes('/lookbook/look-05.jpg'), false);
  // Cream colourway PDP still needs its own shots. Those are not the flagged frames.
  assert.ok(hoodie.includes('/products/hoodie-cream-front.jpg'));
  assert.ok(hoodie.includes('/products/hoodie-cream-worn-front.jpg'));
  assert.equal(hoodie.includes('/lookbook/look-02.jpg'), false);
  assert.equal(hoodie.includes('/lookbook/look-05.jpg'), false);
});

test('quick view and the product page can add the chosen variant', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const renderer = createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });
  const quick = await renderer.renderProductConfig(PRODUCTS['OT-HOOD']);
  const pdp = await renderer.renderProduct(PRODUCTS['OT-HOOD']);
  for (const html of [quick, pdp]) {
    assert.match(html, /<form method="post" action="\/api\/theme-preview\/cart\/add\.js"/);
    assert.match(html, /class="hdt-main-product-form"/);
    assert.match(html, /name="id" value="OT-HOOD-onyx-black-xs"/);
    assert.match(html, /450 GSM garment-dyed heavyweight fleece/);
    assert.equal(html.includes('Go kalles'), false);
    assert.equal(html.includes('Nike'), false);
  }
  assert.match(quick, /id="product-form-main-quick-viewOT-HOOD"/);
  assert.match(pdp, /id="product-form-main-productOT-HOOD"/);
  assert.match(pdp, /name="Color" value="Onyx Black"[^>]*checked/);
  assert.match(pdp, /name="Size" value="XS"[^>]*checked/);
  assert.doesNotMatch(pdp, /name="Size" value="M"[^>]*checked/);
  assert.match(pdp, /can-has-media-group/);
  assert.match(pdp, /data-mdid="\d+"/);
  assert.match(pdp, /update-when-variant-change/);

  // The browser posts multipart FormData. The size the customer picked has to
  // survive that parse, and the drawer HTML has to come back with the line.
  const body = parseFormBody(
    '--b\r\nContent-Disposition: form-data; name="id"\r\n\r\nOT-HOOD-onyx-black-m\r\n'
    + '--b\r\nContent-Disposition: form-data; name="quantity"\r\n\r\n1\r\n'
    + '--b\r\nContent-Disposition: form-data; name="sections"\r\n\r\ncart-drawer\r\n'
    + '--b--\r\n',
    'multipart/form-data; boundary=b',
  );
  const decoded = decodeVariantId(body.id);
  assert.deepEqual(decoded, { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M' });
  const lines = addLine([], { ...decoded, quantity: 1 });
  const cart = cartJson(lines, { siteUrl: SITE });
  const sections = await renderer.renderCartSections(cart, body.sections);
  const drawer = sections['cart-drawer'] || '';
  assert.match(drawer, /cart-items-component/);
  assert.match(drawer, /data-count="1"/);
  assert.match(drawer, /OTRACE Oversized Hoodie/);
  assert.match(drawer, /Onyx Black \/ M/);
  assert.match(drawer, /\$80\.00/);

  const gone = changeLine(lines, 'OT-HOOD-onyx-black-m', 0);
  assert.equal(gone.length, 0);
});

function sectionHtml(html, id) {
  const marker = `id="shopify-section-${id}"`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `missing section ${id}`);
  const next = html.indexOf('id="shopify-section-', start + marker.length);
  return html.slice(start, next === -1 ? undefined : next);
}

function mainSlides(html) {
  const slides = [];
  const re = /<div\s+([^>]*hdt-product__media-item[^>]*)>[\s\S]*?<img[^>]*src="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    slides.push({
      attrs: match[1],
      src: match[2],
      hidden: /(?:^|\s)hidden(?:\s|$)/.test(match[1]),
      group: /data-group-value="([^"]*)"/.exec(match[1])?.[1] ?? '',
      id: /data-media-id="([^"]*)"/.exec(match[1])?.[1] ?? '',
    });
  }
  return slides;
}

test('a colour link shows that colour’s photos and submits that variant', async () => {
  const { createThemeRenderer } = await import('./render-page.js');
  const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
  const renderer = createThemeRenderer({
    themeRoot,
    siteUrl: SITE,
    assetBase: '/api/theme-assets',
    routesRoot: '/api/theme-preview/',
  });

  const cases = [
    ['OT-HOOD', 'OT-HOOD-warm-cream-xs', 'Warm Cream', 'XS', 'hoodie-cream-worn-front.jpg', 'hoodie-onyx'],
    ['OT-HOOD', 'OT-HOOD-onyx-black-s', 'Onyx Black', 'S', 'hoodie-onyx-worn-front.jpg', 'hoodie-cream'],
    ['OT-PANT', 'OT-PANT-warm-cream-m', 'Warm Cream', 'M', 'pant-cream-worn.jpg', 'pant-onyx'],
    ['OT-PANT', 'OT-PANT-onyx-black-xl', 'Onyx Black', 'XL', 'pant-onyx-worn.jpg', 'pant-cream'],
  ];

  for (const [sku, id, colour, size, lead, other] of cases) {
    const html = await renderer.renderProduct(PRODUCTS[sku], { variantId: id });
    assert.match(html, new RegExp(`name="Color" value="${colour}"[^>]*checked`), id);
    assert.match(html, new RegExp(`name="Size" value="${size}"[^>]*checked`), id);
    assert.match(html, new RegExp(`name="id" value="${id}"`), id);
    assert.match(html, new RegExp(`update-url="${id}"`), id);
    assert.match(html, /\$80\.00/);
    assert.match(html, /\$100\.00/);

    const slides = mainSlides(html);
    assert.ok(slides.length >= 3, `${id} rendered no gallery`);
    const visible = slides.filter((slide) => !slide.hidden);
    const hidden = slides.filter((slide) => slide.hidden);
    assert.ok(visible.length, `${id} hid every frame`);
    assert.ok(hidden.length, `${id} still shows both colours`);
    assert.ok(visible.every((slide) => slide.group === colour), `${id} visible groups: ${visible.map((s) => s.group).join(',')}`);
    assert.ok(visible.every((slide) => !slide.src.includes(other)), `${id} visible src leaked ${other}`);
    assert.match(visible[0].src, new RegExp(lead));
    const mdid = visible[0].id;
    assert.match(html, new RegExp(`data-mdid="${mdid}"[^>]*value="${id}"`));
  }
});

test('garment dyed leads with the definition and keeps the four steps on one row', async () => {
  const { pageContent } = await import('./pages.js');
  const html = pageContent('garment-dyed').content;
  const quote = 'Garment dyed means the piece is sewn first and dyed afterwards, so the colour settles into the seams. OTRACE hoodies and sweatpants are garment dyed 450 GSM cotton fleece in Onyx Black and Warm Cream.';
  const leadAt = html.indexOf(`<p class="hdt-dye-lead">${quote}</p>`);
  const stepsAt = html.indexOf('hdt-dye-steps');
  const versusAt = html.indexOf('Garment dyed vs piece dyed');
  assert.ok(leadAt >= 0, 'the definition has to be the lead, in his wording');
  assert.ok(leadAt < stepsAt, 'the definition has to sit above Knit–Cut–Sew–Dye');
  assert.ok(stepsAt < versusAt, 'the comparison stays below the process strip');
  assert.match(html, />Knit</);
  assert.match(html, />Cut</);
  assert.match(html, />Sew</);
  assert.match(html, />Dye the finished garment</);
  assert.match(html, /\$80\.00 \(was \$100\.00\)/);
  assert.match(html, /\$140\.00 \(was \$200\.00\)/);
  assert.match(html, /hoodie-onyx-front\.jpg/);
  assert.match(html, /hoodie-cream-front\.jpg/);
  const css = readFileSync(fileURLToPath(new URL('./otrace-overrides.css', import.meta.url)), 'utf8');
  assert.match(css, /\.hdt-dye-steps > li \{[^}]*margin-block:\s*0/);
  assert.match(css, /body:has\(\.hdt-dye\) \.shopify-section-main-heading \.hdt-heading-liquid/);
});

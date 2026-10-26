import assert from 'node:assert/strict';
import test from 'node:test';

import { createCheckoutSession } from '../checkout-session.js';
import { PRODUCTS, SET_TOTAL_CENTS } from '../catalog.js';
import { addLine, cartJson, changeLine, decodeVariantId } from './cart.js';
import { parseFormBody } from './form-body.js';
import { parseThemeJson, resolveLinkListSettings, stripJsonComments } from './liquid-engine.js';
import { themeSettings, toShopifyProduct } from './shopify-shape.js';

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

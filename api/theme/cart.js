/**
 * A Shopify-shaped cart for the Kalles theme, on our own stack.
 *
 * The theme's JS talks to /cart.js, /cart/add.js, /cart/change.js and
 * /cart/update.js and expects Shopify's exact response shape. This module
 * provides that shape over our own catalogue.
 *
 * Only the LINE REFERENCES are stored in the cookie - sku, colour, size and
 * quantity. Every price is recomputed from api/catalog.js on each read, by the
 * same buildLineItems() that prices a real checkout, so the drawer shows the
 * matched-set rate correctly and a tampered cookie cannot change what anyone
 * is charged.
 */
import { PRODUCTS, buildLineItems, formatMoney } from '../catalog.js';
import { toShopifyProduct } from './shopify-shape.js';

export const CART_COOKIE = 'otrace_theme_cart';

/** The theme addresses a line by variant id; decode it back to a real product. */
export function decodeVariantId(variantId) {
  const id = String(variantId ?? '');
  const sku = Object.keys(PRODUCTS).find((s) => id.toUpperCase().startsWith(s + '-'));
  if (!sku) return null;
  const rest = id.slice(sku.length + 1);
  const product = PRODUCTS[sku];
  // Size handles are unambiguous (xs, s, m, ... 3xl) and always last.
  const size = product.sizes.find((s) => rest.toLowerCase().endsWith('-' + s.toLowerCase()));
  if (!size) return null;
  const colourHandle = rest.slice(0, rest.length - size.length - 1).toLowerCase();
  const colour = product.colours.find(
    (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-') === colourHandle,
  );
  if (!colour) return null;
  return { sku, colour, size };
}

const variantIdFor = (sku, colour, size) =>
  `${sku}-${String(colour).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(size).toLowerCase()}`;

export const readCartCookie = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    // A malformed cookie is an empty cart, never an error page.
    return [];
  }
};

export const writeCartCookie = (lines) =>
  Buffer.from(JSON.stringify(lines), 'utf8').toString('base64url');

/**
 * Price the stored lines and return Shopify's /cart.js shape.
 *
 * buildLineItems is the single pricing authority, and it returns one Stripe
 * line per PRICE BAND rather than per cart row, so the per-unit price is read
 * back from its total rather than assumed.
 */
export function cartJson(lines, { siteUrl = '' } = {}) {
  const { normalised } = buildLineItems(lines, { siteUrl });

  /**
   * buildLineItems splits one cart row by PRICE BAND - two hoodies with one
   * sweatpant come back as a hoodie at the set rate, a hoodie at the single
   * rate and a sweatpant at the set rate. That is right for Stripe and wrong
   * for a cart drawer, which would show three lines for two things added.
   * Group them back and express the difference the way Shopify does: an
   * original line price plus a discount allocation.
   */
  const grouped = new Map();
  for (const row of Array.isArray(normalised) ? normalised : []) {
    const key = `${row.sku}|${row.colour}|${row.size}`;
    const found = grouped.get(key);
    if (found) {
      found.quantity += row.quantity;
      found.total += row.lineTotalCents;
    } else {
      grouped.set(key, { ...row, quantity: row.quantity, total: row.lineTotalCents });
    }
  }

  const items = [...grouped.values()].map((row, index) => {
    const product = PRODUCTS[row.sku];
    const shaped = toShopifyProduct(product, { siteUrl });
    const id = variantIdFor(row.sku, row.colour, row.size);
    const original = product.priceCents * row.quantity;
    const image =
      shaped.images.find((i) =>
        String(i.alt).toLowerCase().includes(String(row.colour).toLowerCase()),
      ) ?? shaped.images[0] ?? null;

    return {
      id,
      key: `${id}:${index}`,
      product_id: row.sku,
      variant_id: id,
      title: `${product.name} - ${row.colour} / ${row.size}`,
      product_title: product.name,
      variant_title: `${row.colour} / ${row.size}`,
      url: `/product/${product.slug}`,
      handle: product.slug,
      sku: row.sku,
      quantity: row.quantity,
      price: product.priceCents,
      original_price: product.priceCents,
      final_price: Math.round(row.total / row.quantity),
      line_price: row.total,
      final_line_price: row.total,
      original_line_price: original,
      line_level_discount_allocations:
        row.total < original
          ? [{
              amount: original - row.total,
              discount_application: { title: 'Set price', type: 'automatic' },
            }]
          : [],
      options_with_values: [
        { name: 'Color', value: row.colour },
        { name: 'Size', value: row.size },
      ],
      featured_image: image,
      image: image ? image.src : null,
      requires_shipping: true,
      properties: {},
      /**
       * The cart template reads item.variant for inventory and quantity rules.
       * We do not track stock, so this says "available, no limit" explicitly
       * rather than leaving the fields undefined for the theme to interpret.
       */
      variant: {
        id,
        title: `${row.colour} / ${row.size}`,
        available: true,
        inventory_management: null,
        inventory_policy: 'continue',
        inventory_quantity: 0,
        quantity_rule: { min: 1, max: null, increment: 1 },
        price: product.priceCents,
        compare_at_price: product.listPriceCents > product.priceCents ? product.listPriceCents : null,
      },
      /**
       * Liquid reads `item.product.title`, not `item.product_title`, so a cart
       * row with no nested product renders a blank, unclickable line - the
       * price and image are there and the customer cannot tell what it is.
       * Kept to the fields themes actually read rather than the whole product,
       * which would repeat every variant on every line.
       */
      product: {
        id: product.sku,
        title: product.name,
        handle: product.slug,
        url: `/product/${product.slug}`,
        vendor: 'OTRACE',
        type: shaped.type,
        has_only_default_variant: false,
        featured_image: image,
      },
    };
  });

  const total = items.reduce((sum, i) => sum + i.final_line_price, 0);
  const original = items.reduce((sum, i) => sum + i.original_line_price, 0);

  return {
    token: 'otrace-theme-cart',
    note: null,
    attributes: {},
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    items,
    total_price: total,
    original_total_price: original,
    total_discount: Math.max(0, original - total),
    currency: 'USD',
    items_subtotal_price: total,
    requires_shipping: items.length > 0,
    formatted_total: formatMoney(total),
  };
}

/** Merge a line into the stored list, as Shopify's /cart/add.js does. */
export function addLine(lines, { sku, colour, size, quantity }) {
  const next = lines.map((l) => ({ ...l }));
  const found = next.find(
    (l) => l.sku === sku && l.colour === colour && l.size === size,
  );
  if (found) found.quantity = Math.min(10, (found.quantity || 1) + quantity);
  else next.push({ sku, colour, size, quantity });
  return next;
}

/** Set one line's quantity; zero removes it, which is how the drawer deletes. */
export function changeLine(lines, variantId, quantity) {
  const decoded = decodeVariantId(variantId);
  if (!decoded) return lines;
  return lines
    .map((l) =>
      l.sku === decoded.sku && l.colour === decoded.colour && l.size === decoded.size
        ? { ...l, quantity }
        : l,
    )
    .filter((l) => l.quantity > 0);
}

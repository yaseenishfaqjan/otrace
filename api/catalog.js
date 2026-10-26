/**
 * The catalogue lives on the server, deliberately.
 *
 * The browser sends only a SKU, a size, a colour and a quantity. Prices are
 * looked up here and never accepted from the client — otherwise anyone could
 * edit the request in devtools and buy the hoodie for a cent.
 */

export const CURRENCY = 'usd';

export const SHIPPING = {
  label: 'Free delivery',
  amountCents: 0,
  minDays: 3,
  maxDays: 5,
};

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const COLORWAYS = ['Onyx Black', 'Warm Cream'];

export const PRODUCTS = {
  'OT-HOOD': {
    sku: 'OT-HOOD',
    slug: 'oversized-hoodie',
    name: 'OTRACE Oversized Hoodie',
    description:
      'Boxy oversized hoodie in 450 GSM garment-dyed heavyweight fleece. Self-lined hood, split kangaroo pocket, metal drawcord tips.',
    priceCents: 14800,
    image: '/products/hoodie-onyx-worn-front.jpg',
    sizes: SIZES,
    colours: COLORWAYS,
    preorder: false,
  },
  'OT-PANT': {
    sku: 'OT-PANT',
    slug: 'wide-leg-sweatpant',
    name: 'OTRACE Wide-Leg Sweatpant',
    description:
      'Wide-leg sweatpant in the same 450 GSM garment-dyed fleece. Drawcord waist with metal tips, ribbed ankle cuff.',
    priceCents: 12800,
    image: '/products/pant-onyx-worn.jpg',
    sizes: SIZES,
    colours: COLORWAYS,
    preorder: false,
  },
};

/**
 * An absolute image URL for Stripe.
 *
 * Stripe fetches these from ITS servers, so a relative path is useless there
 * and a wrong host is invisible until a customer is already on the payment
 * page. These used to be hard-coded to `https://otrace.com`, which has no DNS
 * record at all - the shop is `otrace.co` - so every checkout thumbnail was
 * dead. Store the path, build the host from SITE_URL, and the two can never
 * drift again.
 */
export const imageUrl = (product, siteUrl) => {
  const src = String(product?.image ?? '');
  if (!src) return undefined;
  if (src.startsWith('http')) return src;
  return `${String(siteUrl ?? '').replace(/\/$/, '')}${src}`;
};

/** Products as the storefront should see them, with absolute image URLs. */
export const publicProducts = (siteUrl) =>
  Object.values(PRODUCTS).map((p) => ({ ...p, image: imageUrl(p, siteUrl) }));

export const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;

/**
 * Turns a browser cart into Stripe line items.
 *
 * Everything is validated: unknown SKUs, sizes we do not cut and colourways we
 * do not make are refused rather than guessed at. An order that cannot be
 * packed is worse than a refused one.
 */
export function buildLineItems(rawItems, { siteUrl } = {}) {
  const lineItems = [];
  const normalised = [];
  const errors = [];

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { lineItems, normalised, errors: ['Your cart is empty.'] };
  }

  if (rawItems.length > 40) {
    return { lineItems, normalised, errors: ['That is too many lines for one order.'] };
  }

  for (const item of rawItems) {
    const sku = String(item?.sku ?? '').trim().toUpperCase();
    const product = PRODUCTS[sku];
    if (!product) {
      errors.push(`We do not sell "${item?.sku ?? ''}".`);
      continue;
    }

    const quantity = Math.min(10, Math.max(1, Number.parseInt(item?.quantity, 10) || 1));

    const wantedSize = String(item?.size ?? '').trim().toUpperCase();
    const size = product.sizes.find((s) => s.toUpperCase() === wantedSize);
    if (!size) {
      errors.push(`Invalid size "${item?.size ?? ''}" for ${product.sku}.`);
      continue;
    }

    const wantedColour = String(item?.colour ?? item?.color ?? '').trim().toLowerCase();
    const colour = product.colours.find((c) => c.toLowerCase() === wantedColour);
    if (!colour) {
      errors.push(`Invalid color "${item?.colour ?? ''}" for ${product.sku}.`);
      continue;
    }

    lineItems.push({
      quantity,
      price_data: {
        currency: CURRENCY,
        unit_amount: product.priceCents, // server-side price, always
        product_data: {
          name: `${product.name} — ${colour}, ${size}`,
          description: product.preorder
            ? `${product.description} PRE-ORDER — ships in ${product.shipsIn}.`
            : product.description,
          images: [imageUrl(product, siteUrl)].filter(Boolean),
          metadata: {
            sku: product.sku,
            size,
            colour,
            ...(product.preorder ? { preorder: 'yes', ships_in: product.shipsIn } : {}),
          },
        },
      },
    });

    normalised.push({
      sku: product.sku,
      name: product.name,
      size,
      colour,
      quantity,
      preorder: Boolean(product.preorder),
      shipsIn: product.preorder ? product.shipsIn : null,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * quantity,
    });
  }

  return { lineItems, normalised, errors };
}

export const subtotalCents = (normalised) =>
  normalised.reduce((sum, i) => sum + i.lineTotalCents, 0);

/* --------------------------------------------- Stripe metadata packing ---- */

/**
 * Stripe caps EACH metadata value at 500 characters. Storing the full item
 * array as JSON blows past that at four line items and Stripe rejects the whole
 * session — which silently makes the biggest orders the only ones that cannot
 * be paid for. So: store only what cannot be re-derived, under one-letter keys,
 * and split across numbered keys so length can never be the limit.
 */
const META_LIMIT = 460;

export function packItems(normalised) {
  const compact = normalised.map((i) => ({ s: i.sku, z: i.size, c: i.colour, q: i.quantity }));
  const json = JSON.stringify(compact);
  const meta = {};

  if (json.length <= META_LIMIT) {
    meta.items = json;
    meta.items_parts = '1';
    return meta;
  }

  let part = 0;
  for (let at = 0; at < json.length; at += META_LIMIT) {
    meta[`items_${part}`] = json.slice(at, at + META_LIMIT);
    part += 1;
  }
  meta.items_parts = String(part);
  return meta;
}

/** Rebuilds full line items from packed metadata, re-expanding from PRODUCTS. */
export function unpackItems(metadata) {
  if (!metadata) return [];

  let json = '';
  const parts = Number(metadata.items_parts ?? 0);
  if (parts > 1) {
    for (let i = 0; i < parts; i += 1) json += metadata[`items_${i}`] ?? '';
  } else {
    json = metadata.items ?? metadata.items_0 ?? '';
  }
  if (!json) return [];

  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw.map((i) => {
    if (i.sku !== undefined) return i; // already the full shape
    const product = PRODUCTS[i.s];
    const quantity = Number(i.q) || 1;
    const unitPriceCents = product?.priceCents ?? 0;
    return {
      sku: i.s,
      name: product?.name ?? i.s,
      size: i.z ?? null,
      colour: i.c ?? null,
      quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      preorder: Boolean(product?.preorder),
      shipsIn: product?.preorder ? product.shipsIn : null,
    };
  });
}

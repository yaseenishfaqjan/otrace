/**
 * A Shopify-shaped cart for the Kalles theme, on our own stack.
 *
 * The theme's JS talks to /cart.js, /cart/add.js, /cart/change.js and
 * /cart/update.js and expects Shopify's exact response shape. This module
 * provides that shape over our own catalogue.
 *
 * Each browser gets its own cart id in the `otrace_theme_cart` cookie. The
 * lines for that id live in the server-side store. The JSON `token` is that
 * same id. The old constant `otrace-theme-cart` is refused, so a missing
 * cookie never falls through to one basket shared by every visitor.
 *
 * Prices are recomputed from api/catalog.js on each read, by the same
 * buildLineItems() that prices a real checkout, so the drawer shows the
 * matched-set rate correctly and a tampered cookie cannot change what anyone
 * is charged.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PRODUCTS, buildLineItems, formatMoney } from '../catalog.js';
import { toShopifyProduct } from './shopify-shape.js';

export const CART_COOKIE = 'otrace_theme_cart';

/**
 * The token every cart JSON used to return. It is not a cart id. Accepting it
 * would put every visitor who has no cookie into one basket.
 */
export const SHARED_CART_TOKEN = 'otrace-theme-cart';

const CART_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const CART_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CART_MAX = 2000;

export const isVisitorCartId = (id) =>
  typeof id === 'string' && id !== SHARED_CART_TOKEN && CART_ID_RE.test(id);

export const mintCartId = () => randomBytes(18).toString('base64url');

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

/**
 * Older browsers stored the line list itself in the cookie, base64url JSON.
 * A new cart id is random and does not decode to an array, so the two shapes
 * cannot be confused. An empty result here means "not a legacy cookie".
 */
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

const legacyLines = (value) => {
  try {
    const text = Buffer.from(String(value), 'base64url').toString('utf8');
    if (!text.startsWith('[')) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, 40) : null;
  } catch {
    return null;
  }
};

/** Drop unknown products. Quantity is capped the same way checkout caps it. */
export function sanitizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (const line of lines) {
    if (out.length >= 40) break;
    const sku = String(line?.sku ?? '').trim().toUpperCase();
    const product = PRODUCTS[sku];
    if (!product) continue;
    const size = product.sizes.find((s) => s.toUpperCase() === String(line.size ?? '').trim().toUpperCase());
    const colour = product.colours.find(
      (c) => c.toLowerCase() === String(line.colour ?? line.color ?? '').trim().toLowerCase(),
    );
    if (!size || !colour) continue;
    const parsed = Number.parseInt(line.quantity, 10);
    if (!Number.isFinite(parsed) || parsed < 1) continue;
    const quantity = Math.min(10, parsed);
    const found = out.find((l) => l.sku === product.sku && l.colour === colour && l.size === size);
    if (found) found.quantity = Math.min(10, found.quantity + quantity);
    else out.push({ sku: product.sku, colour, size, quantity });
  }
  return out;
}

export function interpretCartCookie(raw) {
  if (raw == null || raw === '') return { kind: 'missing' };
  let value = String(raw);
  try { value = decodeURIComponent(value); } catch { /* already decoded */ }
  if (value === SHARED_CART_TOKEN) return { kind: 'shared' };
  const legacy = legacyLines(value);
  if (legacy) return { kind: 'legacy', lines: sanitizeLines(legacy) };
  if (isVisitorCartId(value)) return { kind: 'id', id: value };
  return { kind: 'invalid' };
}

export function readRequestCookie(req, name) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return '';
}

export function cartCookieOptions(req, { clear = false } = {}) {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: Boolean(req?.secure),
  };
  if (!clear) options.maxAge = CART_TTL_MS;
  return options;
}

export function writeCartIdCookie(req, res, id) {
  if (!isVisitorCartId(id)) return;
  const options = cartCookieOptions(req);
  if (typeof res.cookie === 'function') {
    res.cookie(CART_COOKIE, id, options);
    return;
  }
  const maxAge = Math.floor(options.maxAge / 1000);
  const secure = options.secure ? '; Secure' : '';
  res.appendHeader?.('Set-Cookie', `${CART_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
    || res.setHeader('Set-Cookie', `${CART_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

/**
 * Lines for one visitor, keyed by cart id.
 *
 * `file` is optional. The API process passes a path so a restart keeps carts.
 * Tests pass none. The shared token is never stored and is dropped if a file
 * from a bad build still contains it.
 */
export function createCartStore({ file = null, now = () => Date.now() } = {}) {
  const linesById = new Map();
  const seenAt = new Map();

  const persist = () => {
    if (!file) return;
    const payload = {};
    for (const [id, lines] of linesById) {
      if (!isVisitorCartId(id)) continue;
      payload[id] = { lines, seen: seenAt.get(id) || now() };
    }
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error('[theme-cart] could not save carts:', err.message);
    }
  };

  const dropExpired = () => {
    const cutoff = now() - CART_TTL_MS;
    for (const [id, seen] of seenAt) {
      if (seen < cutoff) {
        linesById.delete(id);
        seenAt.delete(id);
      }
    }
    while (linesById.size > CART_MAX) {
      let oldest = null;
      let oldestSeen = Infinity;
      for (const [id, seen] of seenAt) {
        if (seen < oldestSeen) {
          oldest = id;
          oldestSeen = seen;
        }
      }
      if (!oldest) break;
      linesById.delete(oldest);
      seenAt.delete(oldest);
    }
  };

  if (file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      let droppedShared = false;
      for (const [id, entry] of Object.entries(parsed && typeof parsed === 'object' ? parsed : {})) {
        if (!isVisitorCartId(id)) {
          if (id === SHARED_CART_TOKEN) droppedShared = true;
          continue;
        }
        const lines = sanitizeLines(entry?.lines);
        if (!lines.length) continue;
        linesById.set(id, lines);
        seenAt.set(id, Number(entry?.seen) || now());
      }
      dropExpired();
      if (droppedShared) persist();
    } catch (err) {
      if (err?.code !== 'ENOENT') console.warn('[theme-cart] could not read cart store:', err.message);
    }
  }

  return {
    get(id) {
      if (!isVisitorCartId(id)) return [];
      const seen = seenAt.get(id);
      if (seen != null && now() - seen > CART_TTL_MS) {
        linesById.delete(id);
        seenAt.delete(id);
        persist();
        return [];
      }
      const lines = linesById.get(id);
      return lines ? lines.map((l) => ({ ...l })) : [];
    },
    set(id, lines) {
      if (!isVisitorCartId(id)) return;
      const clean = sanitizeLines(lines);
      if (!clean.length) {
        linesById.delete(id);
        seenAt.delete(id);
      } else {
        linesById.set(id, clean);
        seenAt.set(id, now());
        dropExpired();
      }
      persist();
    },
    delete(id) {
      if (!linesById.has(id)) return;
      linesById.delete(id);
      seenAt.delete(id);
      persist();
    },
  };
}

let singleton;
export function getThemeCartStore() {
  if (!singleton) {
    const file = process.env.THEME_CART_FILE
      || path.join(os.tmpdir(), 'otrace-theme-carts.json');
    singleton = createCartStore({ file });
  }
  return singleton;
}

/**
 * Resolve the visitor's cart and make sure the response sets their cookie.
 *
 * A missing, shared, or garbage cookie mints a new empty cart. A legacy
 * line-list cookie is copied into a new private id for that browser only.
 * A known id that is not in the store is an empty cart for that id — never
 * someone else's basket.
 */
export function attachCart(req, res, store) {
  const seen = interpretCartCookie(readRequestCookie(req, CART_COOKIE));
  let id;
  let lines;
  if (seen.kind === 'id') {
    id = seen.id;
    lines = store.get(id);
  } else if (seen.kind === 'legacy' && seen.lines.length) {
    id = mintCartId();
    store.set(id, seen.lines);
    lines = store.get(id);
  } else {
    id = mintCartId();
    lines = [];
  }
  writeCartIdCookie(req, res, id);
  return { id, lines };
}

export function clearThemeCart(req, res, store = getThemeCartStore()) {
  const seen = interpretCartCookie(readRequestCookie(req, CART_COOKIE));
  if (seen.kind === 'id') store.delete(seen.id);
  const options = cartCookieOptions(req, { clear: true });
  if (typeof res.clearCookie === 'function') res.clearCookie(CART_COOKIE, options);
  else res.setHeader('Set-Cookie', `${CART_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * Price the stored lines and return Shopify's /cart.js shape.
 *
 * buildLineItems is the single pricing authority, and it returns one Stripe
 * line per PRICE BAND rather than per cart row, so the per-unit price is read
 * back from its total rather than assumed.
 *
 * `token` is the visitor's cart id. A missing or shared token is replaced
 * with a fresh id so this function cannot emit the global cart token.
 */
export function cartJson(lines, { siteUrl = '', token } = {}) {
  const cartToken = isVisitorCartId(token) ? token : mintCartId();
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
    const variant = shaped.variants.find((v) => v.id === id);
    const image = variant?.featured_image
      ?? shaped.images.find((i) =>
        String(i.alt).toLowerCase().includes(String(row.colour).toLowerCase()),
      )
      ?? shaped.images[0]
      ?? null;

    return {
      id,
      key: `${id}:${index}`,
      index,
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
    token: cartToken,
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

const clampQty = (quantity) => Math.min(10, Math.max(0, Number.parseInt(quantity, 10) || 0));

/**
 * Set one line's quantity. Zero removes it, which is how the drawer deletes.
 *
 * The theme's cart JS sends a 1-based `line` index (`{ line, quantity }`),
 * not a variant id. A bare integer is that index. Variant ids are not integers.
 */
export function changeLine(lines, variantId, quantity) {
  const key = String(variantId ?? '');
  const qty = clampQty(quantity);
  if (/^[1-9]\d*$/.test(key)) {
    const index = Number(key) - 1;
    return lines
      .map((l, i) => (i === index ? { ...l, quantity: qty } : l))
      .filter((l) => l.quantity > 0);
  }
  const decoded = decodeVariantId(key);
  if (!decoded) return lines;
  return lines
    .map((l) =>
      l.sku === decoded.sku && l.colour === decoded.colour && l.size === decoded.size
        ? { ...l, quantity: qty }
        : l,
    )
    .filter((l) => l.quantity > 0);
}

/**
 * Shopify's /cart/update.js sends `updates` as a variant-id map. The cart
 * form sends `updates[]` as a quantity per line, in display order.
 */
export function applyUpdates(lines, updates) {
  if (Array.isArray(updates)) {
    return lines
      .map((l, i) => {
        if (updates[i] == null || updates[i] === '') return { ...l };
        return { ...l, quantity: clampQty(updates[i]) };
      })
      .filter((l) => l.quantity > 0);
  }
  let next = lines.map((l) => ({ ...l }));
  for (const [variantId, qty] of Object.entries(updates || {})) {
    next = changeLine(next, variantId, qty);
  }
  return next;
}

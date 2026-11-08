/**
 * Checkout Sessions as the orders dashboard sees them.
 *
 * Stripe is the source of truth for money, items and addresses. The `orders`
 * table (written by the webhook) and `order_cache` fill in when Stripe is
 * slow or down. Live Stripe fields win; a saved row still shows if Stripe
 * does not return that session.
 */
import { buildLineItems, unpackItems } from './catalog.js';

export const PKT_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 25;

export function money(cents, currency = 'usd') {
  const amount = (Number(cents || 0) / 100).toFixed(2);
  if (String(currency || 'usd').toLowerCase() === 'usd') return `$${amount}`;
  return `${amount} ${String(currency || '').toUpperCase()}`;
}

export function orderReference(id) {
  return `OT-${String(id || '').slice(-8).toUpperCase()}`;
}

function stamp(ms, offset) {
  const date = new Date(ms + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Asia/Karachi is UTC+5 all year, so the wall clock does not need a TZ database. */
export function formatBoth(unixSeconds) {
  const unix = Number(unixSeconds);
  if (!Number.isFinite(unix) || unix <= 0) return { utc: '', pkt: '' };
  const ms = unix * 1000;
  return { utc: `${stamp(ms, 0)} UTC`, pkt: `${stamp(ms, PKT_MS)} PKT` };
}

export function startOfKarachiDay(nowMs) {
  const shifted = new Date(nowMs + PKT_MS);
  const midnightUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return midnightUtc - PKT_MS;
}

export function karachiDayStart(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(Number(match[1]), month - 1, day) - PKT_MS;
}

export function karachiDayEnd(ymd) {
  const start = karachiDayStart(ymd);
  if (start == null) return null;
  return start + DAY_MS - 1;
}

function hostOf(value) {
  try { return new URL(String(value)).host.toLowerCase(); }
  catch { return ''; }
}

export function belongsToSite(session, siteUrl = 'https://otrace.co') {
  const host = hostOf(siteUrl);
  const success = hostOf(session?.success_url);
  const cancel = hostOf(session?.cancel_url);
  if (host && (success === host || cancel === host || success.endsWith(`.${host}`) || cancel.endsWith(`.${host}`))) {
    return true;
  }
  const meta = session?.metadata || {};
  return Boolean(meta.items || meta.items_0 || meta.items_parts || meta.subtotal_cents);
}

/** Keep this shop's sessions. If none match, the key is treated as OTRACE-only. */
export function sessionsForSite(sessions, siteUrl) {
  const matched = sessions.filter((session) => belongsToSite(session, siteUrl));
  return matched.length ? matched : sessions.slice();
}

function parseLineName(name) {
  const cleaned = String(name || '').replace(/\s*\(set of two\)\s*$/i, '').trim();
  const match = /^(.*?)\s+[—–-]\s+([^,]+),\s*([A-Za-z0-9]+)$/.exec(cleaned);
  if (!match) return { product: cleaned, colour: '', size: '' };
  return { product: match[1].trim(), colour: match[2].trim(), size: match[3].trim().toUpperCase() };
}

function metaItems(session) {
  const raw = unpackItems(session?.metadata);
  if (!raw.length) return [];
  const rebuilt = buildLineItems(raw.map((item) => ({
    sku: item.sku,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
  })));
  // Rebuilding applies the set price only when Stripe did not send line amounts.
  // A later catalogue price change must not rewrite what was charged.
  const rows = !rebuilt.errors?.length && rebuilt.normalised?.length ? rebuilt.normalised : raw;
  return rows.map((item) => ({
    sku: item.sku || '',
    product: item.name || item.sku || 'Item',
    colour: item.colour || '',
    size: item.size || '',
    quantity: item.quantity || 1,
    unitPriceCents: item.unitPriceCents || 0,
    lineTotalCents: item.lineTotalCents || 0,
  }));
}

function lineItems(session) {
  const lines = session?.line_items?.data;
  if (!Array.isArray(lines) || !lines.length) return [];
  return lines.map((line) => {
    const product = line?.price?.product;
    const meta = product && typeof product === 'object' ? (product.metadata || {}) : {};
    const named = (product && typeof product === 'object' && product.name) || line.description || '';
    const parsed = parseLineName(named);
    const quantity = Number(line.quantity) || 1;
    const unit = Number(line?.price?.unit_amount);
    const lineTotal = Number.isFinite(Number(line.amount_total))
      ? Number(line.amount_total)
      : (Number.isFinite(unit) ? unit * quantity : 0);
    return {
      sku: String(meta.sku || '').toUpperCase(),
      product: parsed.product || named || meta.sku || 'Item',
      colour: meta.colour || parsed.colour || '',
      size: meta.size || parsed.size || '',
      quantity,
      unitPriceCents: Number.isFinite(unit) ? unit : (quantity ? Math.round(lineTotal / quantity) : 0),
      lineTotalCents: lineTotal,
    };
  });
}

function itemsFromSession(session) {
  const fromLines = lineItems(session);
  const fromMeta = metaItems(session);
  if (fromLines.length && fromLines.every((item) => item.sku)) return fromLines;
  if (fromLines.length && fromMeta.length === fromLines.length) {
    return fromLines.map((line, index) => ({
      ...fromMeta[index],
      ...line,
      sku: line.sku || fromMeta[index].sku,
      colour: line.colour || fromMeta[index].colour,
      size: line.size || fromMeta[index].size,
      product: line.product || fromMeta[index].product,
    }));
  }
  return fromLines.length ? fromLines : fromMeta;
}

function promoCodes(session) {
  const discounts = session?.total_details?.breakdown?.discounts || [];
  const codes = [];
  for (const entry of discounts) {
    const discount = entry?.discount || entry;
    const promo = discount?.promotion_code;
    const code = typeof promo === 'string' ? '' : promo?.code;
    const coupon = discount?.coupon;
    const name = typeof coupon === 'string' ? coupon : (coupon?.name || coupon?.id);
    const label = code || name || (typeof promo === 'string' ? promo : '');
    if (label && !codes.includes(String(label))) codes.push(String(label));
  }
  return codes;
}

function shippingFrom(session) {
  const raw = session?.collected_information?.shipping_details || session?.shipping_details || null;
  const address = raw?.address || {};
  const billing = session?.customer_details?.address || {};
  return {
    name: raw?.name || session?.customer_details?.name || '',
    line1: address.line1 || billing.line1 || '',
    line2: address.line2 || billing.line2 || '',
    city: address.city || billing.city || '',
    state: address.state || billing.state || '',
    postalCode: address.postal_code || billing.postal_code || '',
    country: String(address.country || billing.country || '').toUpperCase(),
  };
}

function refundFrom(session) {
  const pi = session?.payment_intent;
  if (!pi || typeof pi !== 'object') {
    return { refundStatus: 'unknown', refundedCents: 0 };
  }
  const refundedCents = Number(pi.amount_refunded) || 0;
  const amount = Number(pi.amount ?? session.amount_total) || 0;
  if (refundedCents <= 0) return { refundStatus: 'none', refundedCents: 0 };
  if (amount > 0 && refundedCents >= amount) return { refundStatus: 'refunded', refundedCents };
  return { refundStatus: 'partial', refundedCents };
}

export function normalizeCheckoutSession(session) {
  const id = String(session?.id || '');
  // Live ids look like cs_live_… and test ids like cs_test_….
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null;
  const shipping = shippingFrom(session);
  const refund = refundFrom(session);
  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id || '');
  const paymentStatus = session.payment_status || '';
  const sessionStatus = session.status || (paymentStatus === 'paid' ? 'complete' : 'open');
  return {
    id,
    created: Number(session.created) || 0,
    customerName: session.customer_details?.name || shipping.name || '',
    email: session.customer_details?.email || '',
    phone: session.customer_details?.phone || '',
    shipping,
    items: itemsFromSession(session),
    discountCents: Number(session.total_details?.amount_discount) || 0,
    promoCodes: promoCodes(session),
    shippingCents: Number(session.total_details?.amount_shipping ?? session.shipping_cost?.amount_total) || 0,
    taxCents: Number(session.total_details?.amount_tax) || 0,
    subtotalCents: Number(session.amount_subtotal) || 0,
    totalCents: Number(session.amount_total) || 0,
    currency: session.currency || 'usd',
    paymentStatus,
    sessionStatus,
    refundStatus: refund.refundStatus,
    refundedCents: refund.refundedCents,
    paymentIntent,
    livemode: typeof session.livemode === 'boolean' ? session.livemode : undefined,
  };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch { return fallback; }
}

export function normalizeLegacyRow(row) {
  if (!row?.stripe_session_id) return null;
  const items = parseJson(row.items_json, []);
  const shippingRaw = parseJson(row.shipping_json, null);
  const address = shippingRaw?.address || {};
  return {
    id: row.stripe_session_id,
    created: Number(row.created_unix) || 0,
    customerName: row.customer_name || shippingRaw?.name || '',
    email: row.email || '',
    phone: row.phone || '',
    shipping: {
      name: shippingRaw?.name || row.customer_name || '',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postal_code || '',
      country: String(address.country || '').toUpperCase(),
    },
    items: (Array.isArray(items) ? items : []).map((item) => ({
      sku: item.sku || '',
      product: item.name || item.sku || 'Item',
      colour: item.colour || '',
      size: item.size || '',
      quantity: item.quantity || 1,
      unitPriceCents: item.unitPriceCents || 0,
      lineTotalCents: item.lineTotalCents || 0,
    })),
    discountCents: 0,
    promoCodes: [],
    shippingCents: 0,
    taxCents: 0,
    subtotalCents: null,
    totalCents: Number(row.amount_total_cents) || 0,
    currency: row.currency || 'usd',
    paymentStatus: row.payment_status || '',
    sessionStatus: 'complete',
    refundStatus: 'unknown',
    refundedCents: 0,
    paymentIntent: row.payment_intent || '',
    livemode: undefined,
  };
}

function hasAddress(shipping) {
  return Boolean(shipping && (shipping.line1 || shipping.city || shipping.country));
}

/** Primary wins. Empty primary fields keep the saved value. */
export function mergeOrders(primary, fallback) {
  if (!fallback) return primary;
  if (!primary) return fallback;
  return {
    ...fallback,
    ...primary,
    email: primary.email || fallback.email,
    customerName: primary.customerName || fallback.customerName,
    phone: primary.phone || fallback.phone,
    shipping: hasAddress(primary.shipping) ? primary.shipping : fallback.shipping,
    items: primary.items?.length ? primary.items : (fallback.items || []),
    promoCodes: primary.promoCodes?.length ? primary.promoCodes : (fallback.promoCodes || []),
    discountCents: Number.isFinite(primary.discountCents) ? primary.discountCents : fallback.discountCents,
    shippingCents: Number.isFinite(primary.shippingCents) ? primary.shippingCents : fallback.shippingCents,
    taxCents: Number.isFinite(primary.taxCents) ? primary.taxCents : fallback.taxCents,
    subtotalCents: Number.isFinite(primary.subtotalCents) ? primary.subtotalCents : fallback.subtotalCents,
    totalCents: Number.isFinite(primary.totalCents) ? primary.totalCents : fallback.totalCents,
    refundStatus: primary.refundStatus && primary.refundStatus !== 'unknown'
      ? primary.refundStatus
      : (fallback.refundStatus || primary.refundStatus || 'unknown'),
    refundedCents: primary.refundStatus && primary.refundStatus !== 'unknown'
      ? (primary.refundedCents || 0)
      : (fallback.refundedCents || 0),
    paymentIntent: primary.paymentIntent || fallback.paymentIntent || '',
    livemode: typeof primary.livemode === 'boolean' ? primary.livemode : fallback.livemode,
    created: primary.created || fallback.created || 0,
  };
}

export function isPaidOrder(order) {
  return order?.sessionStatus === 'complete'
    && (order.paymentStatus === 'paid' || order.paymentStatus === 'no_payment_required');
}

export const FULFILMENT_STATUSES = ['unfulfilled', 'packed', 'shipped', 'delivered'];

export function defaultFulfilment() {
  return { status: 'unfulfilled', trackingNumber: '', carrier: '', note: '' };
}

function matchesProduct(order, product) {
  const items = order.items || [];
  const has = (sku, word) => items.some((item) => item.sku === sku || String(item.product || '').toLowerCase().includes(word));
  if (product === 'hoodie') return has('OT-HOOD', 'hoodie');
  if (product === 'sweatpant') return has('OT-PANT', 'sweatpant');
  if (product === 'set') return has('OT-HOOD', 'hoodie') && has('OT-PANT', 'sweatpant');
  return true;
}

export function filterOrders(orders, query = {}) {
  const tab = query.tab === 'open' ? 'open' : 'paid';
  const q = String(query.q || '').trim().toLowerCase();
  const status = FULFILMENT_STATUSES.includes(query.status) ? query.status : '';
  const country = String(query.country || '').trim().toUpperCase();
  const product = ['hoodie', 'sweatpant', 'set'].includes(query.product) ? query.product : '';
  const from = karachiDayStart(query.from);
  const to = karachiDayEnd(query.to);
  return orders.filter((order) => {
    const open = order.sessionStatus === 'open' || order.sessionStatus === 'expired';
    if (tab === 'open' ? !open : open) return false;
    if (q) {
      const hay = [order.id, orderReference(order.id), order.email, order.customerName, order.phone]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status && (order.fulfilment?.status || 'unfulfilled') !== status) return false;
    if (country && (order.shipping?.country || '') !== country) return false;
    if (product && !matchesProduct(order, product)) return false;
    const createdMs = (order.created || 0) * 1000;
    if (from != null && createdMs < from) return false;
    if (to != null && createdMs > to) return false;
    return true;
  });
}

function windowStats(orders, startMs, nowMs) {
  const rows = orders.filter((order) => {
    const createdMs = (order.created || 0) * 1000;
    return createdMs >= startMs && createdMs <= nowMs;
  });
  const revenueCents = rows.reduce((sum, order) => sum + Math.max(0, (order.totalCents || 0) - (order.refundedCents || 0)), 0);
  return { count: rows.length, revenueCents };
}

export function summarize(orders, nowMs) {
  const paid = (orders || []).filter(isPaidOrder);
  const todayStart = startOfKarachiDay(nowMs);
  const today = windowStats(paid, todayStart, nowMs);
  const days7 = windowStats(paid, todayStart - 6 * DAY_MS, nowMs);
  const days30 = windowStats(paid, todayStart - 29 * DAY_MS, nowMs);
  const size = {};
  const colour = {};
  const monthRows = paid.filter((order) => {
    const createdMs = (order.created || 0) * 1000;
    return createdMs >= todayStart - 29 * DAY_MS && createdMs <= nowMs;
  });
  for (const order of monthRows) {
    for (const item of order.items || []) {
      const qty = Number(item.quantity) || 0;
      if (item.size) size[item.size] = (size[item.size] || 0) + qty;
      if (item.colour) colour[item.colour] = (colour[item.colour] || 0) + qty;
    }
  }
  return {
    today,
    days7,
    days30: {
      ...days30,
      aovCents: days30.count ? Math.round(days30.revenueCents / days30.count) : 0,
    },
    units: { size, colour },
  };
}

export function paginate(rows, page, perPage = PAGE_SIZE) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage) || 1);
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  const start = (current - 1) * perPage;
  return { page: current, pages, total, perPage, rows: rows.slice(start, start + perPage) };
}

export function formatAddress(shipping) {
  if (!shipping) return '';
  const cityLine = [shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(' ');
  return [shipping.name, shipping.line1, shipping.line2, cityLine, shipping.country].filter(Boolean).join('\n');
}

export function stripeDashboardUrl(order) {
  const test = order?.livemode === false || String(order?.id || '').includes('_test_');
  const root = test ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com';
  if (order?.paymentIntent && /^pi_[A-Za-z0-9_]+$/.test(order.paymentIntent)) {
    return `${root}/payments/${order.paymentIntent}`;
  }
  return `${root}/checkout/sessions/${encodeURIComponent(order?.id || '')}`;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function itemCsv(item, currency) {
  return [
    item.product,
    item.colour,
    item.size,
    `x${item.quantity}`,
    money(item.lineTotalCents, currency),
  ].filter(Boolean).join(' / ');
}

export function ordersToCsv(orders) {
  const header = [
    'date_utc', 'date_karachi', 'reference', 'order_id', 'customer_name', 'email', 'phone',
    'address', 'country', 'items', 'discount', 'promo', 'shipping', 'tax', 'subtotal', 'total',
    'currency', 'payment_status', 'refund_status', 'fulfilment', 'tracking_number', 'carrier', 'note',
  ];
  const lines = [header.join(',')];
  for (const order of orders) {
    const when = formatBoth(order.created);
    const cells = [
      when.utc,
      when.pkt,
      orderReference(order.id),
      order.id,
      order.customerName,
      order.email,
      order.phone,
      formatAddress(order.shipping).replace(/\n/g, ', '),
      order.shipping?.country || '',
      (order.items || []).map((item) => itemCsv(item, order.currency)).join('; '),
      money(order.discountCents, order.currency),
      (order.promoCodes || []).join(' '),
      money(order.shippingCents, order.currency),
      money(order.taxCents, order.currency),
      Number.isFinite(order.subtotalCents) ? money(order.subtotalCents, order.currency) : '',
      money(order.totalCents, order.currency),
      String(order.currency || '').toUpperCase(),
      order.paymentStatus,
      order.refundStatus,
      order.fulfilment?.status || 'unfulfilled',
      order.fulfilment?.trackingNumber || '',
      order.fulfilment?.carrier || '',
      order.fulfilment?.note || '',
    ];
    lines.push(cells.map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function drain(stripe, query) {
  const all = [];
  let startingAfter = '';
  for (let page = 0; page < 10; page += 1) {
    const res = await stripe.checkout.sessions.list({
      ...query,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    all.push(...data);
    if (!res?.has_more || data.length === 0) break;
    startingAfter = data[data.length - 1].id;
  }
  return all;
}

async function listStatus(stripe, status) {
  const base = { limit: 100, status };
  try {
    return await drain(stripe, {
      ...base,
      expand: ['data.line_items.data.price.product', 'data.payment_intent'],
    });
  } catch (err) {
    console.warn(`[admin] stripe list (${status}) expand failed (${err.message})`);
    return drain(stripe, base);
  }
}

async function listStripeSessions(stripe) {
  const out = [];
  for (const status of ['complete', 'open', 'expired']) {
    out.push(...await listStatus(stripe, status));
  }
  const seen = new Set();
  return out.filter((session) => {
    if (!session?.id || seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
}

function rememberFulfilment(order, fulfilmentById) {
  const saved = fulfilmentById.get(order.id);
  return { ...order, fulfilment: saved || defaultFulfilment() };
}

/**
 * One collector per process mount so a page of filters does not list Stripe
 * again for 30 seconds, and tests do not share another mount's cache.
 */
export function createOrderCollector({ cacheMs = 30_000 } = {}) {
  let memo = null;
  let inflight = null;

  async function refresh(stripe, store, siteUrl) {
    if (!stripe?.checkout?.sessions?.list) {
      return { sessions: [], warning: 'Stripe is not configured. Showing saved orders.' };
    }
    try {
      const listed = sessionsForSite(await listStripeSessions(stripe), siteUrl);
      for (const session of listed) {
        const order = normalizeCheckoutSession(session);
        if (!order) continue;
        try { await store.upsertCache(order); }
        catch (err) { console.warn('[admin] cache write failed:', err.message); }
        if (isPaidOrder(order)) {
          try { await store.insertLegacy(session); }
          catch (err) { console.warn('[admin] order write failed:', err.message); }
        }
      }
      return { sessions: listed, warning: '' };
    } catch (err) {
      console.warn('[admin] stripe list failed:', err.message);
      return { sessions: null, warning: 'Stripe could not be reached. Showing saved orders.' };
    }
  }

  return {
    async collect({ stripe, store, siteUrl, now = Date.now() }) {
      if (!memo || cacheMs <= 0 || now - memo.at >= cacheMs) {
        if (!inflight) {
          inflight = refresh(stripe, store, siteUrl)
            .then((result) => { memo = { at: now, ...result }; })
            .finally(() => { inflight = null; });
        }
        await inflight;
      }

      const byId = new Map();
      for (const order of await store.listLegacy()) {
        if (order?.id) byId.set(order.id, order);
      }
      for (const order of await store.listCache()) {
        if (order?.id) byId.set(order.id, mergeOrders(order, byId.get(order.id)));
      }
      if (Array.isArray(memo?.sessions)) {
        for (const session of memo.sessions) {
          const order = normalizeCheckoutSession(session);
          if (!order) continue;
          byId.set(order.id, mergeOrders(order, byId.get(order.id)));
        }
      }
      const fulfilmentById = new Map((await store.listFulfilment()).map((row) => [row.id, row]));
      const orders = [...byId.values()].map((order) => rememberFulfilment(order, fulfilmentById));
      return { orders, warning: memo?.warning || '' };
    },
  };
}

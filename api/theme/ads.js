/**
 * Paid-ads tags for the theme.
 *
 * Meta and TikTok base code follow the GA4 / Clarity rule: one snippet in
 * <head>, and nothing at all when the env is blank. Purchase money comes
 * from the Stripe session this server retrieves. The success URL's query
 * string is only a session id.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { PRODUCTS, SET_SKUS, SET_TOTAL_CENTS, SET_UNIT_CENTS, buildLineItems, unpackItems } from '../catalog.js';
import { gaMeasurementId } from './pages.js';

const RUNTIME = fs.readFileSync(new URL('./ads-runtime.js', import.meta.url), 'utf8');

const SESSION_ID = /^cs_(?:live|test)_[A-Za-z0-9]{8,200}$/;
const capiSent = new Set();

export function resetCapiDedupe() {
  capiSent.clear();
}

/** Public pixel id. Blank unless it is digits only, so it cannot break out of the script. */
export function metaPixelId() {
  const id = String(process.env.META_PIXEL_ID ?? '').trim();
  if (!/^\d{8,20}$/.test(id)) return '';
  return id;
}

/** Public TikTok pixel id. Blank unless it is a single safe token. */
export function tiktokPixelId() {
  const id = String(process.env.TIKTOK_PIXEL_ID ?? '').trim();
  if (!/^[A-Za-z0-9]{8,32}$/.test(id)) return '';
  return id;
}

function metaCapiToken() {
  const token = String(process.env.META_CAPI_TOKEN ?? '').trim();
  if (!token || /\s/.test(token) || token.length < 20 || token.length > 512) return '';
  return token;
}

/**
 * Official Meta base code, including one PageView.
 * `eventID` is there so a later Conversions API call can dedupe that PageView.
 */
export function metaPixelTag() {
  const id = metaPixelId();
  if (!id) return '';
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView', {}, {eventID: 'pageview.' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10)});
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" alt="" /></noscript>
<!-- End Meta Pixel Code -->`;
}

/** Official TikTok base code. `ttq.page()` is the PageView. */
export function tiktokPixelTag() {
  const id = tiktokPixelId();
  if (!id) return '';
  return `<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('${id}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`;
}

function dollars(cents) {
  return Math.round(Number(cents)) / 100;
}

function productEvent(product) {
  const value = dollars(product.priceCents);
  return {
    content_ids: [product.sku],
    content_type: 'product',
    content_name: product.name,
    value,
    currency: 'USD',
    contents: [{ id: product.sku, quantity: 1, item_price: value }],
    items: [{ item_id: product.sku, item_name: product.name, price: value, quantity: 1 }],
  };
}

function setEvent() {
  const unit = dollars(SET_UNIT_CENTS);
  const value = dollars(SET_TOTAL_CENTS);
  const items = SET_SKUS.map((sku) => ({
    item_id: sku,
    item_name: PRODUCTS[sku].name,
    price: unit,
    quantity: 1,
  }));
  return {
    content_ids: [...SET_SKUS],
    content_type: 'product',
    content_name: 'Complete set',
    value,
    currency: 'USD',
    contents: items.map((item) => ({ id: item.item_id, quantity: 1, item_price: unit })),
    items,
  };
}

export function adsCatalog() {
  return {
    currency: 'USD',
    setUnit: dollars(SET_UNIT_CENTS),
    setTotal: dollars(SET_TOTAL_CENTS),
    products: Object.fromEntries(Object.values(PRODUCTS).map((product) => [product.sku, {
      name: product.name,
      price: dollars(product.priceCents),
    }])),
  };
}

/** What this page should tell the pixels. Purchase is set by the success route. */
export function adsContext(extra = {}) {
  const given = extra.ads && typeof extra.ads === 'object' ? extra.ads : {};
  let product = given.product || null;
  if (!product && extra.canonical_path === '/product/complete-set') product = setEvent();
  if (!product && extra.request?.page_type === 'product') {
    const catalogue = PRODUCTS[extra.product?.id] || PRODUCTS[extra.product?.sku];
    if (catalogue) product = productEvent(catalogue);
  }
  return {
    product,
    purchase: given.purchase || null,
  };
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Commerce events for whichever channels are configured.
 * Omitted entirely when Meta, TikTok, and GA4 are all blank.
 */
export function adsEventsTag(extra = {}) {
  const meta = Boolean(metaPixelId());
  const tiktok = Boolean(tiktokPixelId());
  const ga = Boolean(gaMeasurementId());
  if (!meta && !tiktok && !ga) return '';
  const context = adsContext(extra);
  const payload = {
    currency: 'USD',
    meta,
    tiktok,
    ga,
    catalog: adsCatalog(),
    product: context.product || null,
    purchase: context.purchase || null,
  };
  return `<script type="application/json" id="otrace-ads">${safeJson(payload)}</script>
<script>${RUNTIME}</script>`;
}

function lineItem(sku, name, variant, price, quantity) {
  const row = {
    item_id: sku,
    item_name: name || PRODUCTS[sku]?.name || sku,
    price,
    quantity,
  };
  if (variant) row.item_variant = variant;
  return row;
}

function fromStripeLines(session) {
  const lines = session?.line_items?.data;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const items = [];
  for (const line of lines) {
    const product = line?.price?.product;
    const meta = product && typeof product === 'object' ? (product.metadata || {}) : {};
    const sku = String(meta.sku || '').trim().toUpperCase();
    if (!PRODUCTS[sku]) return null;
    const quantity = Number(line.quantity);
    const unit = Number(line?.price?.unit_amount);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
    if (!Number.isFinite(unit) || unit < 0) return null;
    const variant = [meta.colour, meta.size].filter(Boolean).join(' / ');
    const name = typeof product.name === 'string' && product.name ? product.name : PRODUCTS[sku].name;
    items.push(lineItem(sku, name, variant, dollars(unit), quantity));
  }
  return items;
}

function fromMetadata(session) {
  const raw = unpackItems(session?.metadata);
  if (!raw.length) return [];
  const { normalised, errors } = buildLineItems(raw.map((item) => ({
    sku: item.sku,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
  })));
  if (!errors?.length && normalised.length) {
    return normalised.map((item) => lineItem(
      item.sku,
      item.name,
      [item.colour, item.size].filter(Boolean).join(' / '),
      dollars(item.unitPriceCents),
      item.quantity,
    ));
  }
  return raw.filter((item) => PRODUCTS[item.sku]).map((item) => lineItem(
    item.sku,
    item.name,
    [item.colour, item.size].filter(Boolean).join(' / '),
    dollars(item.unitPriceCents),
    item.quantity || 1,
  ));
}

/**
 * Purchase payload for the pixel and for Conversions API.
 * `value` is `amount_total` on the session. Query-string prices never get here.
 * Returns null unless Stripe says the session was paid.
 */
export function purchaseFromStripeSession(session) {
  if (!session || typeof session !== 'object') return null;
  const id = String(session.id || '');
  if (!SESSION_ID.test(id)) return null;
  const status = String(session.payment_status || '');
  if (status !== 'paid' && status !== 'no_payment_required') return null;
  if (session.amount_total == null || session.amount_total === '') return null;
  const amount = Number(session.amount_total);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = String(session.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  const items = fromStripeLines(session) || fromMetadata(session);
  const content_ids = [];
  for (const item of items) {
    if (item.item_id && !content_ids.includes(item.item_id)) content_ids.push(item.item_id);
  }
  const num_items = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    event_id: `purchase.${id}`,
    transaction_id: id,
    value: dollars(amount),
    currency,
    content_ids,
    content_type: 'product',
    num_items,
    items,
  };
}

/**
 * Retrieve the session, then build the purchase. A bad id or a Stripe error
 * is a thank-you page with no purchase event, not a guessed total.
 */
export async function loadVerifiedPurchase(stripe, sessionId) {
  const id = String(sessionId ?? '').trim();
  if (!SESSION_ID.test(id)) return { purchase: null, email: '' };
  if (typeof stripe?.checkout?.sessions?.retrieve !== 'function') return { purchase: null, email: '' };
  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price.product'],
    });
    return {
      purchase: purchaseFromStripeSession(session),
      email: String(session?.customer_details?.email || ''),
    };
  } catch (err) {
    console.warn('[ads] stripe session retrieve failed:', err.message);
    return { purchase: null, email: '' };
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function userData(context) {
  const data = {};
  const email = String(context.email || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) data.em = [sha256(email)];
  const ip = String(context.clientIp || '').split(',')[0].trim();
  if (/^[0-9a-fA-F:.]+$/.test(ip) && ip.length <= 64) data.client_ip_address = ip;
  const agent = String(context.userAgent || '').trim().slice(0, 512);
  if (agent) data.client_user_agent = agent;
  for (const [key, value] of [['fbp', context.fbp], ['fbc', context.fbc]]) {
    const clean = String(value || '').trim();
    if (/^[A-Za-z0-9._-]{1,200}$/.test(clean)) data[key] = clean;
  }
  return data;
}

/**
 * Server-side Meta Purchase. No-op when META_CAPI_TOKEN or META_PIXEL_ID is
 * missing. The event_id matches the browser Purchase for the same session.
 * A second call in this process for that id is skipped; Meta also dedupes
 * on event_name + event_id when the webhook and the success page both send.
 */
export async function sendMetaPurchase(purchase, context = {}, fetchImpl = globalThis.fetch) {
  const pixelId = metaPixelId();
  const token = metaCapiToken();
  if (!pixelId || !token) return { skipped: true, reason: 'unconfigured' };
  if (!purchase?.event_id || purchase.value == null) return { skipped: true, reason: 'no-purchase' };
  if (capiSent.has(purchase.event_id)) return { skipped: true, reason: 'duplicate' };
  capiSent.add(purchase.event_id);
  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: purchase.event_id,
      action_source: 'website',
      event_source_url: context.eventSourceUrl || undefined,
      user_data: userData(context),
      custom_data: {
        currency: purchase.currency,
        value: purchase.value,
        content_ids: purchase.content_ids,
        content_type: 'product',
        num_items: purchase.num_items,
        order_id: purchase.transaction_id,
        contents: (purchase.items || []).map((item) => ({
          id: item.item_id,
          quantity: item.quantity,
          item_price: item.price,
        })),
      },
    }],
  };
  const url = `https://graph.facebook.com/v23.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      capiSent.delete(purchase.event_id);
      console.warn(`[ads] meta capi ${purchase.event_id} failed (${response.status})`);
      return { ok: false, status: response.status };
    }
    return { ok: true };
  } catch (err) {
    capiSent.delete(purchase.event_id);
    console.warn(`[ads] meta capi ${purchase.event_id} failed (${err.message})`);
    return { ok: false, error: err.message };
  }
}

export function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0 || trimmed.slice(0, eq) !== name) continue;
    try { return decodeURIComponent(trimmed.slice(eq + 1)); }
    catch { return ''; }
  }
  return '';
}

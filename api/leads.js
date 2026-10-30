/**
 * Lead capture shared by /api/subscribe, /api/waitlist and /api/contact.
 * MySQL is the durable store. Klaviyo is called after the row is written.
 */

import { syncSubscriber } from './klaviyo.js';

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

export const INQUIRY_LABELS = {
  order: 'Order',
  sizing: 'Sizing',
  wholesale: 'Wholesale / custom / collab',
  other: 'Something else',
};

const INQUIRY_TYPES = new Map([
  ['order', 'order'],
  ['sizing', 'sizing'],
  ['wholesale', 'wholesale'],
  ['wholesale / custom / collab', 'wholesale'],
  ['other', 'other'],
  ['something else', 'other'],
]);

function text(value, max) {
  const cleaned = String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function flag(value) {
  return value === true || value === 1 || value === 'true' || value === '1';
}

function utcStamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function pathOf(value) {
  let raw = text(value, 300);
  if (!raw) return null;
  try {
    if (/^https?:/i.test(raw)) raw = new URL(raw).pathname;
  } catch {
    return null;
  }
  raw = raw.split('?')[0].split('#')[0];
  if (!raw.startsWith('/')) return null;
  return raw.slice(0, 255);
}

function phoneOf(value) {
  if (value == null || String(value).trim() === '') return null;
  const phone = text(value, 32);
  if (!phone || !/^[+0-9][0-9\s().-]{6,31}$/.test(phone)) {
    return { error: 'That phone number does not look right.' };
  }
  return phone;
}

function methodOf(value) {
  const method = (text(value, 64) || 'web-form').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return method.slice(0, 64) || 'web-form';
}

export function normalizeSubscribe(body = {}) {
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) return { error: 'That email does not look right.' };
  if (body.marketingConsent === false || body.marketing_consent === false) {
    return { error: 'Consent is required to join the list.' };
  }

  const phone = phoneOf(body.phone);
  if (phone && typeof phone === 'object') return phone;

  const source = text(body.source, 64) || 'footer';
  const formId = text(body.formId ?? body.form_id, 64) || source;

  return {
    email,
    source,
    formId,
    path: pathOf(body.path ?? body.page),
    productSlug: text(body.productSlug ?? body.product_slug ?? body.product, 128),
    size: text(body.size, 32),
    colour: text(body.colour ?? body.color, 64),
    phone,
    marketingConsentAt: utcStamp(),
    marketingConsentMethod: methodOf(body.marketingConsentMethod ?? body.marketing_consent_method),
    smsConsent: flag(body.smsConsent ?? body.sms_consent),
    whatsappConsent: flag(body.whatsappConsent ?? body.whatsapp_consent),
  };
}

export function normalizeContact(body = {}) {
  // The Kalles ask-a-question form posts Shopify names (contact[name],
  // contact[email], contact[body]). express.urlencoded nests those under
  // contact. The /contact page posts flat name/email/message as JSON.
  const contact = body.contact && typeof body.contact === 'object' ? body.contact : {};
  const name = text(body.name ?? contact.name, 255);
  const email = String(body.email ?? contact.email ?? '').trim().slice(0, 255);
  const productLine = text(body.product ?? contact.product, 500);
  const phone = text(body.phone ?? contact.phone, 64);
  const subject = text(body.subject ?? contact.subject, 255)
    || (productLine ? productLine.slice(0, 255) : null);
  let message = text(body.message ?? contact.message ?? contact.body, 5000);
  if (message && productLine && !message.includes(productLine)) {
    message = `${message}\n\nAbout: ${productLine}`.slice(0, 5000);
  }
  if (message && phone) message = `${message}\nPhone: ${phone}`.slice(0, 5000);
  const rawType = text(body.inquiryType ?? body.inquiry_type ?? body.type ?? contact.inquiryType, 64);
  let inquiryType = null;
  if (rawType) {
    inquiryType = INQUIRY_TYPES.get(rawType.toLowerCase()) ?? null;
    if (!inquiryType) return { error: 'Choose an inquiry type.' };
  }
  if (!name || !isEmail(email) || !message) {
    return { error: 'Name, a valid email and a message are all needed.' };
  }
  return { name, email, subject, message, inquiryType };
}

export function inquiryLabel(type) {
  return INQUIRY_LABELS[type] ?? null;
}

/**
 * What /api/contact tells the browser after the enquiry row is stored.
 * `emailed` is true only when a provider accepted mail to SHOP_EMAIL.
 * Anything else is a failure with the public address, not a fake success.
 */
export function contactOutcome({ emailed, shopEmail } = {}) {
  if (emailed) return { status: 200, json: { ok: true, emailed: true } };
  const error = shopEmail
    ? 'We could not email that. Write to info@otrace.co and it will reach us.'
    : 'Email is not set up on this shop yet. Write to info@otrace.co and it will reach us.';
  return { status: 503, json: { ok: false, emailed: false, error } };
}

const SUBSCRIBER_COLUMNS = [
  ['path', 'VARCHAR(255) NULL'],
  ['product_slug', 'VARCHAR(128) NULL'],
  ['size', 'VARCHAR(32) NULL'],
  ['colour', 'VARCHAR(64) NULL'],
  ['phone', 'VARCHAR(32) NULL'],
  ['form_id', 'VARCHAR(64) NULL'],
  ['marketing_consent_at', 'DATETIME NULL'],
  ['marketing_consent_method', 'VARCHAR(64) NULL'],
  ['sms_consent', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['whatsapp_consent', 'TINYINT(1) NOT NULL DEFAULT 0'],
];

export async function ensureLeadColumns(pool) {
  for (const [name, definition] of SUBSCRIBER_COLUMNS) {
    try {
      await pool.query(`ALTER TABLE subscribers ADD COLUMN ${name} ${definition}`);
    } catch (err) {
      if (err?.code !== 'ER_DUP_FIELDNAME' && err?.errno !== 1060) throw err;
    }
  }
  try {
    await pool.query('ALTER TABLE enquiries ADD COLUMN inquiry_type VARCHAR(64) NULL');
  } catch (err) {
    if (err?.code !== 'ER_DUP_FIELDNAME' && err?.errno !== 1060) throw err;
  }
}

function updateParams(lead) {
  const sms = lead.smsConsent ? 1 : 0;
  const whatsapp = lead.whatsappConsent ? 1 : 0;
  return [
    lead.source,
    lead.path, lead.path,
    lead.productSlug, lead.productSlug,
    lead.size, lead.size,
    lead.colour, lead.colour,
    lead.phone, lead.phone,
    lead.formId,
    lead.marketingConsentAt,
    lead.marketingConsentMethod,
    sms,
    whatsapp,
    lead.email,
  ];
}

export async function handleSubscribe(pool, body, { sendWelcome, sync = syncSubscriber } = {}) {
  const lead = normalizeSubscribe(body);
  if (lead.error) return { status: 400, json: { error: lead.error } };

  const [[existing]] = await pool.query(
    'SELECT id FROM subscribers WHERE email = ? LIMIT 1',
    [lead.email],
  );

  if (existing) {
    await pool.query(
      `UPDATE subscribers SET
         source = ?,
         path = IF(? IS NULL, path, ?),
         product_slug = IF(? IS NULL, product_slug, ?),
         size = IF(? IS NULL, size, ?),
         colour = IF(? IS NULL, colour, ?),
         phone = IF(? IS NULL, phone, ?),
         form_id = ?,
         marketing_consent_at = COALESCE(marketing_consent_at, ?),
         marketing_consent_method = COALESCE(marketing_consent_method, ?),
         sms_consent = GREATEST(sms_consent, ?),
         whatsapp_consent = GREATEST(whatsapp_consent, ?)
       WHERE email = ?`,
      updateParams(lead),
    );
  } else {
    await pool.query(
      `INSERT INTO subscribers (
         email, source, path, product_slug, size, colour, phone, form_id,
         marketing_consent_at, marketing_consent_method, sms_consent, whatsapp_consent
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead.email,
        lead.source,
        lead.path,
        lead.productSlug,
        lead.size,
        lead.colour,
        lead.phone,
        lead.formId,
        lead.marketingConsentAt,
        lead.marketingConsentMethod,
        lead.smsConsent ? 1 : 0,
        lead.whatsappConsent ? 1 : 0,
      ],
    );
    if (sendWelcome) await sendWelcome(lead.email);
  }

  const esp = await sync(lead);
  return {
    status: 200,
    json: { ok: true, alreadySubscribed: Boolean(existing), esp: esp.status },
  };
}

export async function handleContact(pool, body) {
  const lead = normalizeContact(body);
  if (lead.error) return { status: 400, json: { error: lead.error } };

  await pool.query(
    'INSERT INTO enquiries (name, email, subject, message, inquiry_type) VALUES (?, ?, ?, ?, ?)',
    [lead.name, lead.email, lead.subject, lead.message, lead.inquiryType],
  );

  return { status: 200, json: { ok: true }, lead };
}

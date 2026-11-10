/**
 * Spam gate for /api/contact and the parts of /api/signup that share it.
 *
 * A dropped contact looks like a normal send: the browser is told the note
 * went through, and nothing is stored or mailed. Rate limits are the
 * exception — those answer 429 so a person can write to info@otrace.co.
 * Signup drops stay a 200 without the discount code, which is the response
 * the popup already treats as "not signed up".
 *
 * The render timestamp is HMAC-signed. A plain millisecond (or unix-second)
 * stamp is also accepted, so a form that only has a clock still works.
 * Missing, too fast (< 3s), and older than 24h are drops.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { contactOutcome, handleContact, inquiryLabel, normalizeContact } from './leads.js';

const MIN_AGE_MS = 3000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BURST_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BURST_MAX = 3;
const DAY_MAX = 10;
const BUILT_IN_TS_SECRET = 'otrace-form-render-v1';

const hits = new Map();

export const CONTACT_RATE_MESSAGE =
  'Too many messages from this network. Email info@otrace.co and a person will reply.';

export const TURNSTILE_MESSAGE = 'Please confirm you are a person, then send it again.';

const REAL_ROBERT = new Set([
  'robert',
  'roberta',
  'roberto',
  'roberts',
  'robertson',
  'roberton',
  'robertsen',
  'robertsson',
]);

const PRICE_WORDS = [
  'prezos', 'prezo',
  'preços', 'preço', 'precos', 'preco',
  'precios', 'precio',
  'prix',
  'preise', 'preis',
  'prezzi', 'prezzo',
  'prijzen', 'prijs',
  'prices', 'pricing', 'price',
  'harga',
  'verð', 'verd',
  'цены', 'цена',
  'fiyatı', 'fiyat',
  'hinta',
  'kostet', 'koster',
  'pris',
  'ceny', 'cena', 'cenu',
].sort((a, b) => b.length - a.length);

const PRICE_PHRASES = [
  'quanto custa',
  'cuánto cuesta',
  'cuanto cuesta',
  'сколько стоит',
  'how much',
  'berapa',
  'combien',
  'сколько',
];

const PRODUCT_RE = /\b(?:hoodies?|sweatpants?|sweats?|pants?|fleece|oversized|garments?|onyx|cream|sizes?|sizing|skus?|drawcords?|waists?|chests?|hems?|sleeves?|dyed|dyeing|dyes?|sets?)\b/i;

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PRICE_RE = new RegExp(
  `(?:^|[^\\p{L}])(?:${PRICE_PHRASES.map(escapeReg).join('|')}|${PRICE_WORDS.map(escapeReg).join('|')})(?:$|[^\\p{L}])`,
  'iu',
);

function clean(value) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim();
}

function tsSecret(env = process.env) {
  const dedicated = clean(env.FORM_TS_SECRET);
  return dedicated || BUILT_IN_TS_SECRET;
}

function signature(ms, env) {
  return createHmac('sha256', tsSecret(env)).update(`otrace-form:${ms}`).digest('hex').slice(0, 32);
}

function unwrap(value) {
  if (Array.isArray(value)) {
    const found = value.find((item) => clean(item));
    return clean(found);
  }
  return clean(value);
}

function filled(value) {
  if (Array.isArray(value)) return value.some((item) => filled(item));
  return clean(value) !== '';
}

export function honeypotFilled(body = {}) {
  return ['otrace_hp', 'website', 'company'].some((key) => filled(body?.[key]));
}

/** HMAC of the render time. Forms write this into `otrace_ts`. */
export function signFormTime(now = Date.now(), env = process.env) {
  const ms = String(Math.floor(Number(now)));
  return `${ms}.${signature(ms, env)}`;
}

/**
 * null when the stamp is inside the window. Otherwise a short reason code.
 * A signed token must verify. A plain 13-digit millisecond or 10-digit
 * second stamp is accepted on its age alone.
 */
export function formTimeStatus(token, now = Date.now(), env = process.env) {
  const raw = unwrap(token);
  if (!raw) return 'missing';
  const signed = /^(\d{13})\.([a-f0-9]{32})$/.exec(raw);
  let ms;
  if (signed) {
    const expected = signature(signed[1], env);
    const a = Buffer.from(signed[2]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return 'bad-signature';
    ms = Number(signed[1]);
  } else if (/^\d{13}$/.test(raw)) {
    ms = Number(raw);
  } else if (/^\d{10}$/.test(raw)) {
    ms = Number(raw) * 1000;
  } else {
    return 'missing';
  }
  const age = now - ms;
  if (!Number.isFinite(age)) return 'missing';
  if (age < MIN_AGE_MS) return 'too-fast';
  if (age > MAX_AGE_MS) return 'too-old';
  return null;
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function turnstileConfig(env = process.env) {
  const siteKey = clean(env.TURNSTILE_SITE_KEY);
  const secretKey = clean(env.TURNSTILE_SECRET_KEY);
  return { siteKey, secretKey, enabled: Boolean(siteKey && secretKey) };
}

export function honeypotInputHtml() {
  return '<input class="otrace-hp" type="text" name="otrace_hp" tabindex="-1" autocomplete="off" aria-hidden="true" value="">';
}

export function timestampInputHtml(now = Date.now(), env = process.env) {
  return `<input type="hidden" name="otrace_ts" value="${signFormTime(now, env)}">`;
}

export function turnstileWidgetHtml(env = process.env) {
  const { enabled, siteKey } = turnstileConfig(env);
  if (!enabled) return '';
  const key = escAttr(siteKey);
  return `<div class="cf-turnstile" data-sitekey="${key}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
}

/** Honeypot, render timestamp, and Turnstile when both keys are set. */
export function spamFieldsHtml({ now = Date.now(), env = process.env } = {}) {
  return honeypotInputHtml() + timestampInputHtml(now, env) + turnstileWidgetHtml(env);
}

/**
 * nginx sets X-Real-IP to $remote_addr and appends that same address to
 * X-Forwarded-For, so a client can prepend fakes to the forwarded list.
 * Prefer the header nginx overwrites, then the last forwarded hop.
 */
export function clientIp(req = {}) {
  const headers = req.headers || {};
  const read = (name) => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (value == null) return '';
    return Array.isArray(value) ? String(value[0] ?? '') : String(value);
  };
  const real = cleanIp(read('x-real-ip').split(',')[0]);
  if (real) return real;
  const parts = read('x-forwarded-for').split(',').map((part) => part.trim()).filter(Boolean);
  const forwarded = cleanIp(parts[parts.length - 1] || '');
  if (forwarded) return forwarded;
  return cleanIp(req.ip || req.socket?.remoteAddress || '') || 'unknown';
}

function cleanIp(value) {
  const ip = String(value || '').trim().replace(/^::ffff:/, '');
  if (!ip || ip.length > 80) return '';
  if (!/^[A-Za-z0-9.:]+$/.test(ip)) return '';
  return ip;
}

export function resetRateLimits(bucket) {
  if (!bucket) {
    hits.clear();
    return;
  }
  const prefix = `${bucket}:`;
  for (const key of hits.keys()) {
    if (key.startsWith(prefix)) hits.delete(key);
  }
}

/** 3 hits per 10 minutes and 10 per rolling day, keyed by bucket and IP. */
export function consumeRateLimit(bucket, ip, now = Date.now()) {
  const key = `${bucket}:${String(ip || 'unknown').slice(0, 80)}`;
  const prev = hits.get(key) || [];
  const day = prev.filter((at) => now - at < DAY_MS);
  const burst = day.filter((at) => now - at < BURST_MS);
  if (hits.size > 2000) {
    for (const [other, times] of hits) {
      if (times.every((at) => now - at >= DAY_MS)) hits.delete(other);
    }
  }
  const overDay = day.length >= DAY_MAX;
  const overBurst = burst.length >= BURST_MAX;
  if (!overDay) day.push(now);
  hits.set(key, day);
  if (overDay) return { limited: true, window: 'day' };
  if (overBurst) return { limited: true, window: '10m' };
  return { limited: false };
}

function siteHosts(env = process.env) {
  const hosts = new Set(['otrace.co']);
  const site = clean(env.SITE_URL);
  if (site) {
    try {
      const host = new URL(site).hostname.toLowerCase().replace(/^www\./, '');
      if (host) hosts.add(host);
    } catch {
      // A relative SITE_URL is not a host to match against.
    }
  }
  return [...hosts];
}

function hostPattern(env) {
  return siteHosts(env).map((host) => escapeReg(host)).join('|');
}

export function countUrls(message) {
  const matches = String(message || '').match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi);
  return matches ? matches.length : 0;
}

function letterRun(token) {
  const bare = String(token).replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  if (!bare || !/^[\p{L}\p{M}]+$/u.test(bare)) return '';
  return bare;
}

function codePoints(value) {
  return [...value].length;
}

const LATIN = /^[A-Za-z\u00C0-\u024F]+$/;
const VOWEL = /[aeiouAEIOUàáâãäåèéêëìíîïòóôõöùúûü]/g;

function isUrlToken(token) {
  return /^https?:\/\//i.test(token) || /^www\./i.test(token);
}

function isEmailToken(token) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(token.replace(/[),.;:]+$/g, ''));
}

/** Long letter-only tokens, or a long Latin token with almost no vowels. */
export function isGibberish(message) {
  const tokens = String(message || '').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (isUrlToken(token) || isEmailToken(token)) continue;
    const run = letterRun(token);
    if (!run) continue;
    const length = codePoints(run);
    if (length > 20) return true;
    if (length >= 15 && LATIN.test(run)) {
      const vowels = run.match(VOWEL);
      const ratio = (vowels ? vowels.length : 0) / length;
      if (ratio < 0.1) return true;
    }
  }
  return false;
}

export function isDomainJunk(message, env = process.env) {
  const text = String(message || '');
  const pattern = hostPattern(env);
  if (!pattern) return false;
  const mention = new RegExp(`(?:https?://)?(?:www\\.)?(?:${pattern})(?![a-z0-9-])`, 'i');
  if (!mention.test(text)) return false;
  const stripped = text.replace(
    new RegExp(`(?:https?://)?(?:www\\.)?(?:${pattern})(?![a-z0-9-])\\S*`, 'gi'),
    ' ',
  );
  if (isGibberish(stripped)) return true;
  const words = stripped.split(/[^\p{L}]+/u).filter((word) => codePoints(word) >= 4);
  return words.length === 0;
}

function isRobertBot(name) {
  const token = clean(name).replace(/\s+/g, ' ');
  if (!token || token.includes(' ')) return false;
  if (!/^robert[a-z]{3,24}$/i.test(token)) return false;
  return !REAL_ROBERT.has(token.toLowerCase());
}

function isBotPrice(name, message) {
  if (!isRobertBot(name)) return false;
  if (codePoints(message) > 220) return false;
  if (PRODUCT_RE.test(message)) return false;
  return PRICE_RE.test(message);
}

/**
 * A reason code, or null when the note should be delivered.
 * Subject and the hidden product field are ignored: the ask-a-question
 * form copies the product into those, which would hide a price-bot note.
 */
export function messageSpamReason(fields = {}, env = process.env) {
  const message = clean(fields.message);
  const name = clean(fields.name);
  if (!message) return null;
  if (countUrls(message) > 1) return 'links';
  if (isGibberish(message)) return 'gibberish';
  if (isDomainJunk(message, env)) return 'domain-junk';
  if (isBotPrice(name, message)) return 'bot-price';
  return null;
}

export function contactFields(body = {}) {
  const contact = body.contact && typeof body.contact === 'object' ? body.contact : {};
  return {
    name: clean(body.name ?? contact.name),
    email: clean(body.email ?? contact.email),
    message: clean(body.message ?? contact.message ?? contact.body),
    subject: clean(body.subject ?? contact.subject),
  };
}

export function guardContact(body = {}, { now = Date.now(), env = process.env } = {}) {
  const fields = contactFields(body);
  const meta = { name: fields.name, email: fields.email, message: fields.message };
  if (honeypotFilled(body)) return { action: 'drop', reason: 'honeypot', meta };
  const time = formTimeStatus(body?.otrace_ts ?? body?.contact?.otrace_ts, now, env);
  if (time) return { action: 'drop', reason: `timestamp-${time}`, meta };
  const lead = normalizeContact(body);
  if (lead.error) return { action: 'invalid', error: lead.error };
  const reason = messageSpamReason(fields, env);
  if (reason) return { action: 'drop', reason, meta };
  return { action: 'accept', meta };
}

export function logDropped(channel, reason, meta = {}, warn = console.warn) {
  const email = clean(meta.email);
  const at = email.lastIndexOf('@');
  const emailDomain = at > 0 ? email.slice(at + 1).replace(/[^a-z0-9.-]/gi, '').slice(0, 40) : '';
  const safeReason = String(reason || 'dropped').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'dropped';
  warn(
    `[${channel}] dropped reason=${safeReason} ip=${cleanIp(meta.ip) || 'unknown'} nameLen=${codePoints(clean(meta.name))} msgLen=${codePoints(clean(meta.message))} emailDomain=${emailDomain || '-'}`,
  );
}

function turnstileToken(body = {}) {
  return body['cf-turnstile-response'] || body.turnstileToken || body.contact?.['cf-turnstile-response'] || '';
}

export async function verifyTurnstile(token, ip, env = process.env, fetchImpl = globalThis.fetch) {
  const { enabled, secretKey } = turnstileConfig(env);
  if (!enabled) return { ok: true, skipped: true };
  const response = clean(token);
  if (!response) return { ok: false, reason: 'missing' };
  try {
    const params = new URLSearchParams({ secret: secretKey, response });
    const remote = cleanIp(ip);
    if (remote) params.set('remoteip', remote);
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: json?.success === true };
  } catch (err) {
    console.warn(`[turnstile] verify failed: ${err?.message || 'error'}`);
    return { ok: false };
  }
}

export async function screenContact(body = {}, {
  now = Date.now(),
  env = process.env,
  ip = 'unknown',
  fetchImpl,
  warn,
} = {}) {
  if (consumeRateLimit('contact', ip, now).limited) {
    return {
      accept: false,
      status: 429,
      json: { ok: false, emailed: false, error: CONTACT_RATE_MESSAGE },
    };
  }
  const gate = guardContact(body, { now, env });
  if (gate.action === 'drop') {
    logDropped('contact', gate.reason, { ip, ...gate.meta }, warn);
    return { accept: false, status: 200, json: { ok: true, emailed: true }, dropped: gate.reason };
  }
  if (gate.action === 'invalid') {
    return {
      accept: false,
      status: 400,
      json: { ok: false, emailed: false, error: gate.error },
    };
  }
  if (turnstileConfig(env).enabled) {
    const verdict = await verifyTurnstile(turnstileToken(body), ip, env, fetchImpl);
    if (!verdict.ok) {
      return {
        accept: false,
        status: 400,
        json: { ok: false, emailed: false, error: TURNSTILE_MESSAGE },
      };
    }
  }
  return { accept: true };
}

/**
 * Screen, store, then email. A drop returns the public success shape and
 * does not call `send`.
 */
export async function receiveContact(pool, body, {
  ip,
  send,
  shopEmail,
  now,
  env,
  fetchImpl,
  warn,
} = {}) {
  const screen = await screenContact(body, { ip, now, env, fetchImpl, warn });
  if (!screen.accept) return screen;

  const result = await handleContact(pool, body);
  if (result.status !== 200) {
    return {
      accept: false,
      status: result.status,
      json: { ok: false, emailed: false, error: result.json?.error || 'Could not send that.' },
    };
  }

  let emailed = false;
  if (shopEmail && send) {
    const { lead } = result;
    const type = inquiryLabel(lead.inquiryType);
    emailed = Boolean(await send({
      to: shopEmail,
      replyTo: lead.email,
      subject: `Enquiry${type ? ` (${type})` : ''}: ${lead.subject || 'no subject'} — ${lead.name}`,
      text: `${type ? `Type: ${type}\n` : ''}${lead.name} <${lead.email}>\n\n${lead.message}`,
    }));
  }
  const outcome = contactOutcome({ emailed, shopEmail });
  return { accept: true, status: outcome.status, json: outcome.json };
}

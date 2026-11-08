/**
 * First-order list signup.
 *
 * The address goes in the same MySQL `subscribers` table as /api/subscribe.
 * The code itself is not created here: the owner makes a promotion code in
 * the Stripe dashboard, and Checkout only lets the customer type it in.
 * A blank SIGNUP_DISCOUNT_CODE means this offer does not exist.
 */

import { handleSubscribe } from './leads.js';

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 8;
const hits = new Map();

export function resetSignupLimiter() {
  hits.clear();
}

/** Blank or unsafe codes disable the offer. Percent falls back to 15. */
export function signupOffer(env = process.env) {
  const raw = String(env.SIGNUP_DISCOUNT_CODE ?? '').trim();
  const code = CODE.test(raw) ? raw : '';
  let percent = Number.parseInt(String(env.SIGNUP_DISCOUNT_PERCENT ?? '').trim(), 10);
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) percent = 15;
  return { code, percent, enabled: Boolean(code) };
}

export function signupSuppressedPath(path) {
  let raw = String(path || '/').split('?')[0].split('#')[0];
  if (raw.length > 1 && raw.endsWith('/')) raw = raw.slice(0, -1);
  const value = raw || '/';
  if (value === '/cart' || value.startsWith('/cart/')) return true;
  if (value === '/order/success' || value.startsWith('/order/success/')) return true;
  if (value === '/checkout' || value.startsWith('/checkout/')) return true;
  return false;
}

function honeypotFilled(body) {
  const value = body?.otrace_hp ?? body?.website ?? body?.company ?? '';
  if (Array.isArray(value)) return value.some((item) => String(item ?? '').trim());
  return String(value ?? '').trim() !== '';
}

function limited(ip, now) {
  const key = String(ip || 'unknown').slice(0, 80);
  const recent = (hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
  if (hits.size > 500) {
    for (const [other, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(other);
    }
  }
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/**
 * Validate, dedupe into `subscribers`, and email the code on the first insert.
 * A filled honeypot looks like success and stores nothing. The code is
 * returned to the browser only after a real signup.
 */
export async function handleSignup(pool, body = {}, { sendDiscount, sync, ip, now = Date.now() } = {}) {
  const offer = signupOffer();
  if (!offer.enabled) return { status: 404, json: { error: 'Signup is not available.' } };
  if (limited(ip, now)) {
    return { status: 429, json: { error: 'Too many attempts. Try again shortly.' } };
  }
  if (honeypotFilled(body)) return { status: 200, json: { ok: true } };

  const result = await handleSubscribe(pool, {
    email: body.email,
    source: 'signup-popup',
    formId: body.formId || body.form_id || 'signup-popup',
    path: body.path || body.page,
    marketingConsent: body.marketingConsent !== false && body.marketing_consent !== false,
  }, { sync });
  if (result.status !== 200) return result;

  if (!result.json.alreadySubscribed && sendDiscount) {
    try {
      await sendDiscount(String(body.email || '').trim().toLowerCase(), offer);
    } catch (err) {
      console.error('[signup] discount email failed:', err.message);
    }
  }

  return {
    status: 200,
    json: {
      ok: true,
      code: offer.code,
      percent: offer.percent,
      alreadySubscribed: Boolean(result.json.alreadySubscribed),
    },
  };
}

/**
 * First-order list signup.
 *
 * The address goes in the same MySQL `subscribers` table as /api/subscribe.
 * The code itself is not created here: the owner makes a promotion code in
 * the Stripe dashboard, and Checkout only lets the customer type it in.
 * A blank SIGNUP_DISCOUNT_CODE means this offer does not exist.
 */

import { handleSubscribe } from './leads.js';
import {
  consumeRateLimit,
  formTimeStatus,
  honeypotFilled,
  logDropped,
  resetRateLimits,
  turnstileConfig,
  verifyTurnstile,
} from './spam.js';

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

export function resetSignupLimiter() {
  resetRateLimits('signup');
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

/**
 * Validate, dedupe into `subscribers`, and email the code on the first insert.
 * A filled honeypot or a bad render timestamp looks like success and stores
 * nothing. The code is returned to the browser only after a real signup.
 * The same 3-per-10-minutes and 10-per-day IP cap as contact applies here.
 */
export async function handleSignup(pool, body = {}, {
  sendDiscount,
  sync,
  ip,
  now = Date.now(),
  env = process.env,
  fetchImpl,
} = {}) {
  const offer = signupOffer();
  if (!offer.enabled) return { status: 404, json: { error: 'Signup is not available.' } };
  if (consumeRateLimit('signup', ip, now).limited) {
    return { status: 429, json: { error: 'Too many attempts. Try again shortly.' } };
  }
  if (honeypotFilled(body)) {
    logDropped('signup', 'honeypot', { ip, email: body.email });
    return { status: 200, json: { ok: true } };
  }
  const time = formTimeStatus(body.otrace_ts, now, env);
  if (time) {
    logDropped('signup', `timestamp-${time}`, { ip, email: body.email });
    return { status: 200, json: { ok: true } };
  }
  if (turnstileConfig(env).enabled) {
    const token = body['cf-turnstile-response'] || body.turnstileToken;
    const verdict = await verifyTurnstile(token, ip, env, fetchImpl);
    if (!verdict.ok) {
      return { status: 400, json: { error: 'Please confirm you are a person, then try again.' } };
    }
  }

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

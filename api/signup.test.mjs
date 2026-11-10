import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createCheckoutSession } from './checkout-session.js';
import { discountEmail } from './emails.js';
import { syncSubscriber } from './klaviyo.js';
import { addLine, cartJson } from './theme/cart.js';
import { standalonePage } from './theme/pages.js';
import { createThemeRenderer } from './theme/render-page.js';
import { signupPopupHtml } from './theme/signup-popup.js';
import { signFormTime } from './spam.js';
import { handleSignup, resetSignupLimiter, signupOffer, signupSuppressedPath } from './signup.js';

const SITE = 'https://otrace.co';
const saved = {
  code: process.env.SIGNUP_DISCOUNT_CODE,
  percent: process.env.SIGNUP_DISCOUNT_PERCENT,
  klaviyoKey: process.env.KLAVIYO_PRIVATE_API_KEY,
  klaviyoList: process.env.KLAVIYO_LIST_ID,
};

function restoreEnv() {
  for (const [key, value] of [
    ['SIGNUP_DISCOUNT_CODE', saved.code],
    ['SIGNUP_DISCOUNT_PERCENT', saved.percent],
    ['KLAVIYO_PRIVATE_API_KEY', saved.klaviyoKey],
    ['KLAVIYO_LIST_ID', saved.klaviyoList],
  ]) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

function setOffer(code, percent = '15') {
  if (code == null) delete process.env.SIGNUP_DISCOUNT_CODE;
  else process.env.SIGNUP_DISCOUNT_CODE = code;
  if (percent == null) delete process.env.SIGNUP_DISCOUNT_PERCENT;
  else process.env.SIGNUP_DISCOUNT_PERCENT = percent;
}

function memoryPool() {
  const rows = new Map();
  const calls = [];
  return {
    calls,
    rows,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id')) {
        const row = rows.get(params[0]);
        return [[row ? { id: 1 } : undefined]];
      }
      if (sql.startsWith('INSERT INTO subscribers')) {
        rows.set(params[0], { email: params[0] });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE subscribers')) return [{ affectedRows: 1 }];
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

function withTs(body = {}, ageMs = 10_000) {
  return { otrace_ts: signFormTime(Date.now() - ageMs), ...body };
}

function fakeStripe() {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        create: async (args) => {
          calls.push(args);
          return { id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1', amount_total: 8000 };
        },
      },
    },
  };
}

test('a blank or unsafe code disables the offer', () => {
  setOffer(null, null);
  assert.equal(signupOffer().enabled, false);
  setOffer('   ', '15');
  assert.equal(signupOffer().enabled, false);
  setOffer('not a code', '15');
  assert.equal(signupOffer().enabled, false);
  setOffer('WELCOME15', '');
  assert.equal(signupOffer().enabled, true);
  assert.equal(signupOffer().percent, 15);
  setOffer('WELCOME15', '15');
  assert.deepEqual(
    { code: signupOffer().code, percent: signupOffer().percent },
    { code: 'WELCOME15', percent: 15 },
  );
  for (const path of ['/cart', '/cart/', '/order/success', '/checkout', '/checkout/pay']) {
    assert.equal(signupSuppressedPath(path), true, path);
    assert.equal(signupPopupHtml(path), '', path);
  }
  assert.match(signupPopupHtml('/'), /id="otrace-signup"/);
  assert.doesNotMatch(signupPopupHtml('/shop'), /WELCOME15/);
  restoreEnv();
});

test('signup rejects a bad email, ignores a honeypot, dedupes, and emails once', async () => {
  setOffer('WELCOME15', '15');
  delete process.env.KLAVIYO_PRIVATE_API_KEY;
  delete process.env.KLAVIYO_LIST_ID;
  resetSignupLimiter();
  const pool = memoryPool();
  const sent = [];
  const sync = async () => ({ status: 'skipped' });
  const sendDiscount = async (email, offer) => { sent.push({ email, offer }); return true; };

  const bad = await handleSignup(pool, withTs({ email: 'not-an-email' }), { sendDiscount, sync, ip: '203.0.113.10' });
  assert.equal(bad.status, 400);
  assert.equal(pool.calls.length, 0);
  assert.equal(sent.length, 0);

  const bot = await handleSignup(pool, {
    email: 'bot@example.com',
    otrace_hp: 'https://spam.example',
  }, { sendDiscount, sync, ip: '203.0.113.11' });
  assert.equal(bot.status, 200);
  assert.equal(bot.json.code, undefined);
  assert.equal(pool.calls.length, 0);
  assert.equal(sent.length, 0);

  const fastNow = Date.now();
  const fast = await handleSignup(pool, {
    email: 'ada@example.com',
    otrace_ts: signFormTime(fastNow),
  }, { sendDiscount, sync, ip: '203.0.113.12', now: fastNow });
  assert.equal(fast.status, 200);
  assert.equal(fast.json.code, undefined);
  assert.equal(pool.calls.length, 0);
  assert.equal(sent.length, 0);

  const missingStamp = await handleSignup(pool, { email: 'ada@example.com' }, { sendDiscount, sync, ip: '203.0.113.13' });
  assert.equal(missingStamp.status, 200);
  assert.equal(missingStamp.json.code, undefined);
  assert.equal(sent.length, 0);

  const first = await handleSignup(pool, withTs({
    email: 'Ada@Example.com ',
    path: '/shop?utm=1',
  }), { sendDiscount, sync, ip: '203.0.113.14' });
  assert.equal(first.status, 200);
  assert.equal(first.json.code, 'WELCOME15');
  assert.equal(first.json.percent, 15);
  assert.equal(first.json.alreadySubscribed, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'ada@example.com');
  assert.equal(pool.calls.filter((call) => call.sql.startsWith('INSERT')).length, 1);
  const insert = pool.calls.find((call) => call.sql.startsWith('INSERT'));
  assert.equal(insert.params[0], 'ada@example.com');
  assert.equal(insert.params[7], 'signup-popup');

  const again = await handleSignup(pool, withTs({ email: 'ada@example.com' }), { sendDiscount, sync, ip: '203.0.113.15' });
  assert.equal(again.status, 200);
  assert.equal(again.json.alreadySubscribed, true);
  assert.equal(again.json.code, 'WELCOME15');
  assert.equal(sent.length, 1);
  assert.equal(pool.calls.filter((call) => call.sql.startsWith('UPDATE')).length, 1);
  assert.equal(pool.rows.size, 1);

  resetSignupLimiter();
  for (let i = 0; i < 3; i += 1) {
    const attempt = await handleSignup(pool, withTs({ email: 'nope' }), { sendDiscount, sync, ip: '203.0.113.99' });
    assert.equal(attempt.status, 400);
  }
  const limited = await handleSignup(pool, withTs({ email: 'ada@example.com' }), { sendDiscount, sync, ip: '203.0.113.99' });
  assert.equal(limited.status, 429);
  assert.equal(sent.length, 1);

  restoreEnv();
  resetSignupLimiter();
});

test('a configured Klaviyo list still receives the signup', async () => {
  setOffer('WELCOME15', '15');
  process.env.KLAVIYO_PRIVATE_API_KEY = 'pk_test_not_real';
  process.env.KLAVIYO_LIST_ID = 'LIST123';
  resetSignupLimiter();
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return { ok: true, status: 202, text: async () => '' };
  };
  try {
    const result = await handleSignup(memoryPool(), withTs({ email: 'ada@example.com', path: '/' }), {
      sendDiscount: async () => true,
      sync: syncSubscriber,
      ip: '203.0.113.20',
    });
    assert.equal(result.status, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /profile-import/);
    assert.match(calls[1].url, /profile-subscription-bulk-create-jobs/);
    assert.equal(calls[0].body.data.attributes.properties.form_id, 'signup-popup');
  } finally {
    globalThis.fetch = original;
    restoreEnv();
    resetSignupLimiter();
  }
});

test('the discount email names the code and checkout does not create a coupon', async () => {
  const mail = discountEmail({ siteUrl: SITE, code: 'WELCOME15', percent: 15 });
  assert.match(mail.subject, /15%/);
  assert.match(mail.html, /WELCOME15/);
  assert.match(mail.html, /#0D0C0B|#F0EBE0/);
  assert.match(mail.text, /WELCOME15/);
  assert.match(mail.text, /checkout/i);
  assert.match(mail.html, /info@|unsubscribe/i);

  const stripe = fakeStripe();
  const { session } = await createCheckoutSession(
    stripe,
    [{ sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M', quantity: 1 }],
    { siteUrl: SITE },
  );
  assert.equal(session.id, 'cs_test_1');
  const [args] = stripe.calls;
  assert.equal(args.allow_promotion_codes, true);
  assert.equal(args.discounts, undefined);
  assert.equal(args.line_items[0].price_data.unit_amount, 8000);
  assert.equal(args.mode, 'payment');
});

test('the popup is omitted when the code is blank, and omitted on cart and success', async () => {
  setOffer(null, null);
  const themeRoot = fileURLToPath(new URL('../theme', import.meta.url));
  const theme = createThemeRenderer({ themeRoot, siteUrl: SITE, assetBase: '/theme-assets', routesRoot: '/' });
  try {
    const hidden = await theme.renderPage('index', {
      title: 'OTRACE',
      page_title: 'OTRACE',
      canonical_path: '/',
    }, 'index');
    assert.equal(hidden.includes('id="otrace-signup"'), false);
    assert.doesNotMatch(hidden, /Unlock my code/);

    setOffer('WELCOME15', '15');
    const home = await theme.renderPage('index', {
      title: 'OTRACE',
      page_title: 'OTRACE',
      canonical_path: '/',
    }, 'index');
    assert.match(home, /id="otrace-signup"/);
    assert.match(home, /Get 15% off your first order/);
    assert.match(home, /Join the OTRACE list for drops and restocks\./);
    assert.match(home, /Unlock my code/);
    assert.match(home, /No spam\. Unsubscribe anytime\./);
    assert.match(home, />Copy</);
    assert.match(home, /Shop now/);
    assert.match(home, /aria-modal="true"/);
    assert.match(home, /aria-label="Close"/);
    assert.match(home, /name="otrace_hp"/);
    assert.match(home, /name="otrace_ts"/);
    assert.match(home, /otrace_ts: ts \? ts\.value : ''/);
    assert.doesNotMatch(home, /WELCOME15/);
    assert.match(home, /otraceLockPage/);
    assert.match(home, /8000/);
    assert.match(home, /0\.5/);
    assert.match(home, /min-width: 768px/);
    assert.match(home, /Escape/);
    assert.match(home, /otrace:lead/);
    assert.match(home, /14 \* 24 \* 60 \* 60 \* 1000/);
    const popupAt = home.indexOf('id="otrace-signup"');
    assert.ok(popupAt > home.indexOf('<style data-otrace>'));
    assert.ok(popupAt < home.lastIndexOf('</body>'));

    const lines = addLine([], { sku: 'OT-HOOD', colour: 'Onyx Black', size: 'M', quantity: 1 });
    const cart = await theme.renderPage('cart', {
      cart: cartJson(lines, { siteUrl: SITE }),
      title: 'Your cart',
      page_title: 'Your cart — OTRACE',
      canonical_path: '/cart',
    });
    assert.equal(cart.includes('id="otrace-signup"'), false);
    assert.match(cart, /Have a code\? Enter it at checkout/);

    const success = await theme.renderPage('page', standalonePage('order-success'), 'page');
    assert.equal(success.includes('id="otrace-signup"'), false);
    assert.doesNotMatch(success, /Unlock my code/);

    const checkout = await theme.renderPage('page', {
      ...standalonePage('order-success'),
      canonical_path: '/checkout',
      title: 'Checkout',
    }, 'page');
    assert.equal(checkout.includes('id="otrace-signup"'), false);
  } finally {
    restoreEnv();
  }
});

test('ads runtime records the signup and the page lock matches the size guide', () => {
  const ads = readFileSync(fileURLToPath(new URL('./theme/ads-runtime.js', import.meta.url)), 'utf8');
  assert.match(ads, /otrace:lead/);
  assert.match(ads, /meta\('Lead'/);
  assert.match(ads, /'SubmitForm'/);
  assert.match(ads, /'generate_lead'/);

  const guards = readFileSync(fileURLToPath(new URL('./theme/theme-guards.js', import.meta.url)), 'utf8');
  assert.match(guards, /window\.otraceLockPage = lockModalPage/);
  assert.match(guards, /body\.style\.position = 'fixed'/);
  assert.match(guards, /otrace-signup__sheet/);

  const css = readFileSync(fileURLToPath(new URL('./theme/otrace-overrides.css', import.meta.url)), 'utf8');
  assert.match(css, /#F2EDE4/);
  assert.match(css, /max-width:\s*767px/);
  assert.match(css, /\.otrace-signup__submit,\s*\.otrace-signup__shop \{[^}]*min-height:\s*44px/);
  assert.match(css, /align-items:\s*flex-end/);
});

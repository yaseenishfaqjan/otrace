import assert from 'node:assert/strict';
import test from 'node:test';

import { toE164, syncSubscriber } from './klaviyo.js';
import { handleContact, handleSubscribe, normalizeSubscribe } from './leads.js';

const savedKey = process.env.KLAVIYO_PRIVATE_API_KEY;
const savedList = process.env.KLAVIYO_LIST_ID;

test.after(() => {
  if (savedKey == null) delete process.env.KLAVIYO_PRIVATE_API_KEY;
  else process.env.KLAVIYO_PRIVATE_API_KEY = savedKey;
  if (savedList == null) delete process.env.KLAVIYO_LIST_ID;
  else process.env.KLAVIYO_LIST_ID = savedList;
});

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
        rows.set(params[0], { email: params[0], size: params[4], colour: params[5] });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE subscribers')) {
        const email = params[params.length - 1];
        const current = rows.get(email) ?? {};
        rows.set(email, { ...current, size: params[5] ?? current.size, colour: params[7] ?? current.colour });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO enquiries')) return [{ affectedRows: 1 }];
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

test('normalize keeps SMS and WhatsApp off unless the flag is explicit', () => {
  const lead = normalizeSubscribe({
    email: 'Ada@Example.com ',
    source: 'footer',
    path: '/sizing?utm=1',
    color: 'Warm Cream',
    productSlug: 'oversized-hoodie',
    size: 'L',
    formId: 'email-my-size',
  });
  assert.equal(lead.email, 'ada@example.com');
  assert.equal(lead.path, '/sizing');
  assert.equal(lead.colour, 'Warm Cream');
  assert.equal(lead.smsConsent, false);
  assert.equal(lead.whatsappConsent, false);
  assert.equal(lead.marketingConsentMethod, 'web-form');
  assert.equal(lead.formId, 'email-my-size');
});

test('refuses a subscribe that explicitly withholds marketing consent', () => {
  const lead = normalizeSubscribe({ email: 'a@b.co', marketingConsent: false });
  assert.equal(lead.error, 'Consent is required to join the list.');
});

test('missing Klaviyo keys skip ESP sync and still store the row', async () => {
  delete process.env.KLAVIYO_PRIVATE_API_KEY;
  delete process.env.KLAVIYO_LIST_ID;
  const warnings = [];
  const original = console.warn;
  console.warn = (line) => warnings.push(line);
  const pool = memoryPool();
  const welcomes = [];
  try {
    const result = await handleSubscribe(pool, {
      email: 'ada@example.com',
      formId: 'waitlist',
      size: 'M',
      colour: 'Onyx Black',
      productSlug: 'wide-leg-sweatpant',
      path: '/product/wide-leg-sweatpant',
    }, { sendWelcome: async (email) => { welcomes.push(email); } });
    assert.equal(result.status, 200);
    assert.equal(result.json.esp, 'skipped');
    assert.equal(result.json.alreadySubscribed, false);
    assert.deepEqual(welcomes, ['ada@example.com']);
    assert.match(warnings.join('\n'), /ESP sync skipped/);
    assert.match(warnings.join('\n'), /MySQL only/);
  } finally {
    console.warn = original;
  }
});

test('a second signup updates size instead of dropping it', async () => {
  delete process.env.KLAVIYO_PRIVATE_API_KEY;
  delete process.env.KLAVIYO_LIST_ID;
  const pool = memoryPool();
  const welcomes = [];
  const sendWelcome = async (email) => { welcomes.push(email); };
  await handleSubscribe(pool, { email: 'ada@example.com', size: 'S', formId: 'waitlist' }, { sendWelcome });
  const again = await handleSubscribe(pool, {
    email: 'ada@example.com',
    size: 'XL',
    colour: 'Warm Cream',
    formId: 'waitlist',
    smsConsent: false,
  }, { sendWelcome });
  assert.equal(again.json.alreadySubscribed, true);
  assert.equal(welcomes.length, 1);
  const update = pool.calls.find((call) => call.sql.startsWith('UPDATE'));
  assert.ok(update);
  assert.match(update.sql, /GREATEST\(sms_consent/);
  assert.equal(update.params[5], 'XL');
  assert.equal(update.params[7], 'Warm Cream');
  assert.equal(update.params[14], 0);
});

test('configured Klaviyo sync posts a profile and a list subscribe', async () => {
  process.env.KLAVIYO_PRIVATE_API_KEY = 'pk_test_not_real';
  process.env.KLAVIYO_LIST_ID = 'LIST123';
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), authorization: options.headers.Authorization });
    return { ok: true, status: 202, text: async () => '' };
  };
  try {
    const result = await syncSubscriber({
      email: 'ada@example.com',
      formId: 'waitlist',
      source: 'waitlist',
      path: '/product/oversized-hoodie',
      productSlug: 'oversized-hoodie',
      size: 'L',
      colour: 'Onyx Black',
      phone: '+15551230000',
      smsConsent: true,
      whatsappConsent: false,
    });
    assert.equal(result.status, 'synced');
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /profile-import/);
    assert.equal(calls[0].body.data.attributes.properties.form_id, 'waitlist');
    assert.equal(calls[0].body.data.attributes.properties.page, '/product/oversized-hoodie');
    assert.equal(calls[0].body.data.attributes.properties.product_slug, 'oversized-hoodie');
    assert.equal(calls[0].body.data.attributes.properties.size, 'L');
    assert.equal(calls[0].body.data.attributes.properties.colour, 'Onyx Black');
    assert.equal(calls[0].body.data.attributes.phone_number, '+15551230000');
    assert.match(calls[1].url, /profile-subscription-bulk-create-jobs/);
    assert.equal(calls[1].body.data.relationships.list.data.id, 'LIST123');
    assert.equal(calls[1].authorization, 'Klaviyo-API-Key pk_test_not_real');
    assert.equal(calls[1].body.data.attributes.profiles.data[0].attributes.subscriptions.email.marketing.consent, 'SUBSCRIBED');
  } finally {
    globalThis.fetch = original;
    delete process.env.KLAVIYO_PRIVATE_API_KEY;
    delete process.env.KLAVIYO_LIST_ID;
  }
});

test('toE164 does not invent a country code', () => {
  assert.equal(toE164('5551230000'), null);
  assert.equal(toE164('+44 7700 900123'), '+447700900123');
});

test('contact stores the wholesale inquiry type', async () => {
  const pool = memoryPool();
  const result = await handleContact(pool, {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Forty sets for a shop.',
    inquiryType: 'Wholesale / custom / collab',
  });
  assert.equal(result.status, 200);
  assert.equal(result.lead.inquiryType, 'wholesale');
  const insert = pool.calls.find((call) => call.sql.startsWith('INSERT INTO enquiries'));
  assert.equal(insert.params[4], 'wholesale');
});

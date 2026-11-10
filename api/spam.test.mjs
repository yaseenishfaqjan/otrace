import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { pageContent } from './theme/pages.js';
import { PRODUCTS } from './catalog.js';
import {
  clientIp,
  consumeRateLimit,
  CONTACT_RATE_MESSAGE,
  contactFields,
  formTimeStatus,
  isDomainJunk,
  isGibberish,
  messageSpamReason,
  receiveContact,
  resetRateLimits,
  signFormTime,
  spamFieldsHtml,
  turnstileConfig,
} from './spam.js';

const REAL = "Hi, what size should I get in the oversized hoodie? I'm 6ft";
const GIBBERISH = 'Gfihudwgfyehjwowjifwhu fuehiqokewwfueiweqijwihrwu ifwiqdjwrhwijwijwirhwu otrace.co';

function memoryPool() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('INSERT INTO enquiries')) return [{ affectedRows: 1 }];
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

function agedBody(extra = {}, ageMs = 5000) {
  const now = Date.now();
  return {
    now,
    body: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: REAL,
      inquiryType: 'sizing',
      otrace_ts: signFormTime(now - ageMs),
      ...extra,
    },
  };
}

test('a real sizing question is not gibberish, domain junk, or a price bot', () => {
  assert.equal(isGibberish(REAL), false);
  assert.equal(isDomainJunk(REAL), false);
  assert.equal(messageSpamReason({ name: 'Ada', message: REAL }), null);
  assert.equal(messageSpamReason({
    name: 'Robertsog',
    message: REAL,
  }), null);
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'Does the oversized hoodie run large?',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'I ordered from otrace.co and the hoodie has not arrived',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'See https://otrace.co/product/oversized-hoodie and tell me if the hem is raw',
  }), null);
  assert.equal(isGibberish('abcdefghijklmnopqrst'), false);
});

test('gibberish is a long letter token or a long token with almost no vowels', () => {
  assert.equal(isGibberish(GIBBERISH), true);
  assert.equal(messageSpamReason({ name: 'Robertsog', message: GIBBERISH }), 'gibberish');
  assert.equal(isGibberish('abcdefghijklmnopqrstu'), true);
  assert.equal(isGibberish('Bcdfghjklmnpqrst is not a word'), true);
  assert.equal(isGibberish('The rhythm section played well tonight'), false);
  assert.equal(isGibberish('See https://otrace.co/product/oversized-hoodie-onyx-black-front-photo'), false);
});

test('a message that is only the site domain plus junk is dropped', () => {
  assert.equal(isDomainJunk('otrace.co'), true);
  assert.equal(isDomainJunk('zz otrace.co'), true);
  assert.equal(isDomainJunk('?? otrace.co'), true);
  assert.equal(messageSpamReason({ name: 'Ada', message: 'otrace.co' }), 'domain-junk');
  assert.equal(isDomainJunk('hello otrace.co'), false);
  assert.equal(isDomainJunk('Please reply about the order on otrace.co'), false);
  assert.equal(isDomainJunk('nototrace.com is a different site'), false);
});

test('more than one link is dropped and a single link is kept', () => {
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'Look at https://a.example/one and https://b.example/two',
  }), 'links');
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'Look at www.a.example and www.b.example please',
  }), 'links');
  assert.equal(messageSpamReason({
    name: 'Ada',
    message: 'The tracking link is https://carrier.example/track/1 and the hem is uneven',
  }), null);
});

test('Robert-plus-random with a short price question and no product is dropped', () => {
  const notes = [
    'Ola, queria saber o seu prezo.',
    'Qual é o preço?',
    'Berapa harga?',
    'Hvað kostar verð?',
    'What is the price?',
    'Сколько цена?',
    'precio?',
    'prix?',
    'preis?',
    'prezzo?',
    'prijs?',
    'pris?',
    'hinta?',
    'cena?',
  ];
  for (const message of notes) {
    assert.equal(messageSpamReason({ name: 'RobertJeant', message }), 'bot-price', message);
    assert.equal(messageSpamReason({ name: 'Robertsog', message }), 'bot-price', message);
    assert.equal(messageSpamReason({ name: 'Maria', message }), null, message);
  }
  assert.equal(messageSpamReason({
    name: 'Robert',
    message: 'Ola, queria saber o seu prezo.',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Roberta',
    message: 'Ola, queria saber o seu prezo.',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Roberto',
    message: 'harga?',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Roberts',
    message: 'price?',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Robertson',
    message: 'price?',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Robert Smith',
    message: 'Ola, queria saber o seu prezo.',
  }), null);
  assert.equal(messageSpamReason({
    name: 'Robertsog',
    message: 'What is the price of the oversized hoodie in size L?',
  }), null);
});

test('the ask form product URL is not treated as a second link in the note', () => {
  const body = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Does this match the photo? https://example.com/mine',
    product: 'Oversized Hoodie - https://otrace.co/product/oversized-hoodie',
    otrace_ts: signFormTime(Date.now() - 5000),
  };
  assert.equal(messageSpamReason(contactFields(body)), null);
  assert.match(contactFields(body).message, /example\.com/);
  assert.doesNotMatch(contactFields(body).message, /otrace\.co\/product/);
});

test('timestamps must be present, at least 3 seconds old, and at most 24 hours', () => {
  const now = 1_700_000_000_000;
  assert.equal(formTimeStatus('', now), 'missing');
  assert.equal(formTimeStatus('nope', now), 'missing');
  assert.equal(formTimeStatus(signFormTime(now - 1000), now), 'too-fast');
  assert.equal(formTimeStatus(signFormTime(now), now), 'too-fast');
  assert.equal(formTimeStatus(signFormTime(now - 2999), now), 'too-fast');
  assert.equal(formTimeStatus(signFormTime(now - 3000), now), null);
  assert.equal(formTimeStatus(signFormTime(now - 5000), now), null);
  assert.equal(formTimeStatus(signFormTime(now - 24 * 60 * 60 * 1000), now), null);
  assert.equal(formTimeStatus(signFormTime(now - 24 * 60 * 60 * 1000 - 1), now), 'too-old');
  assert.equal(formTimeStatus(String(now - 5000), now), null);
  assert.equal(formTimeStatus(String(Math.floor((now - 5000) / 1000)), now), null);
  assert.equal(formTimeStatus(String(now - 1000), now), 'too-fast');
  const forged = `${now - 5000}.${'ab'.repeat(16)}`;
  assert.equal(formTimeStatus(forged, now), 'bad-signature');
  const html = spamFieldsHtml({ now: now - 4000 });
  const token = /name="otrace_ts" value="([^"]+)"/.exec(html)[1];
  assert.equal(formTimeStatus(token, now), null);
  assert.match(html, /name="otrace_hp"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /class="otrace-hp"/);
});

test('turnstile stays off until both keys are set', () => {
  assert.equal(turnstileConfig({}).enabled, false);
  assert.equal(turnstileConfig({ TURNSTILE_SITE_KEY: 'site' }).enabled, false);
  assert.equal(turnstileConfig({ TURNSTILE_SECRET_KEY: 'secret' }).enabled, false);
  assert.equal(turnstileConfig({ TURNSTILE_SITE_KEY: ' site ', TURNSTILE_SECRET_KEY: 'secret' }).enabled, true);
  assert.equal(spamFieldsHtml({ env: {} }).includes('cf-turnstile'), false);
  assert.match(spamFieldsHtml({
    env: { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret' },
  }), /data-sitekey="site-key"/);
});

test('the client IP comes from X-Real-IP, else the last X-Forwarded-For hop', () => {
  assert.equal(clientIp({
    headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.2.3.4, 198.51.100.8' },
    ip: '10.0.0.1',
  }), '203.0.113.5');
  assert.equal(clientIp({
    headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
    ip: '10.0.0.1',
  }), '203.0.113.9');
  assert.equal(clientIp({ headers: {}, ip: '::ffff:192.0.2.4' }), '192.0.2.4');
  assert.equal(clientIp({ headers: { 'x-real-ip': 'not an ip\n' }, ip: '192.0.2.8' }), '192.0.2.8');
});

test('rate limit is 3 per 10 minutes and 10 per day', () => {
  resetRateLimits('contact');
  const start = Date.UTC(2026, 0, 2);
  const ip = '203.0.113.40';
  for (let i = 0; i < 3; i += 1) {
    assert.equal(consumeRateLimit('contact', ip, start + i).limited, false);
  }
  const burst = consumeRateLimit('contact', ip, start + 4);
  assert.equal(burst.limited, true);
  assert.equal(burst.window, '10m');
  const later = start + 11 * 60 * 1000;
  assert.equal(consumeRateLimit('contact', ip, later).limited, false);
  for (let i = 0; i < 5; i += 1) {
    const at = later + (i + 1) * 11 * 60 * 1000;
    assert.equal(consumeRateLimit('contact', ip, at).limited, false, String(i));
  }
  const eleventh = later + 7 * 11 * 60 * 1000;
  const blocked = consumeRateLimit('contact', ip, eleventh);
  assert.equal(blocked.limited, true);
  assert.equal(blocked.window, 'day');
  assert.equal(consumeRateLimit('contact', '203.0.113.41', start).limited, false);
  resetRateLimits('contact');
});

test('dropped notes look sent, are not mailed, and the log omits the text', async () => {
  resetRateLimits('contact');
  const pool = memoryPool();
  const sent = [];
  const logs = [];
  const send = async (message) => {
    sent.push(message);
    return true;
  };
  const warn = (line) => logs.push(String(line));
  const { now, body } = agedBody({
    name: 'Robertsog',
    email: 'robertsog@spam.test',
    message: GIBBERISH,
  });
  const dropped = await receiveContact(pool, body, {
    ip: '203.0.113.70',
    send,
    shopEmail: 'info@otrace.co',
    now,
    warn,
  });
  assert.equal(dropped.status, 200);
  assert.equal(dropped.json.ok, true);
  assert.equal(dropped.json.emailed, true);
  assert.equal(dropped.dropped, 'gibberish');
  assert.equal(sent.length, 0);
  assert.equal(pool.calls.length, 0);
  assert.match(logs[0], /reason=gibberish/);
  assert.match(logs[0], /ip=203\.0\.113\.70/);
  assert.match(logs[0], /emailDomain=spam\.test/);
  assert.doesNotMatch(logs.join('\n'), /Robertsog/);
  assert.doesNotMatch(logs.join('\n'), /Gfihud/);
  assert.doesNotMatch(logs.join('\n'), /robertsog@/);

  const honeypot = await receiveContact(pool, agedBody({ otrace_hp: 'https://spam.example' }).body, {
    ip: '203.0.113.71',
    send,
    shopEmail: 'info@otrace.co',
    now: Date.now(),
    warn,
  });
  assert.equal(honeypot.json.emailed, true);
  assert.equal(honeypot.dropped, 'honeypot');
  assert.equal(sent.length, 0);

  const missing = await receiveContact(pool, { ...agedBody().body, otrace_ts: '' }, {
    ip: '203.0.113.72',
    send,
    shopEmail: 'info@otrace.co',
    now: Date.now(),
    warn,
  });
  assert.equal(missing.dropped, 'timestamp-missing');
  assert.equal(sent.length, 0);

  const fastNow = Date.now();
  const fast = await receiveContact(pool, {
    ...agedBody().body,
    otrace_ts: signFormTime(fastNow),
  }, {
    ip: '203.0.113.73',
    send,
    shopEmail: 'info@otrace.co',
    now: fastNow,
    warn,
  });
  assert.equal(fast.dropped, 'timestamp-too-fast');
  assert.equal(sent.length, 0);
  resetRateLimits('contact');
});

test('a real enquiry is stored and mailed, and the fourth in ten minutes is refused', async () => {
  resetRateLimits('contact');
  const pool = memoryPool();
  const sent = [];
  const send = async (message) => {
    sent.push(message);
    return true;
  };
  const ip = '203.0.113.80';
  const first = agedBody();
  const ok = await receiveContact(pool, first.body, {
    ip,
    send,
    shopEmail: 'info@otrace.co',
    now: first.now,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.emailed, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'info@otrace.co');
  assert.equal(sent[0].replyTo, 'ada@example.com');
  assert.match(sent[0].subject, /Sizing/);
  assert.match(sent[0].text, /oversized hoodie/);
  assert.equal(pool.calls.length, 1);

  for (let i = 0; i < 2; i += 1) {
    const next = agedBody({ email: `ada${i}@example.com` });
    const again = await receiveContact(pool, next.body, {
      ip,
      send,
      shopEmail: 'info@otrace.co',
      now: next.now,
    });
    assert.equal(again.json.emailed, true);
  }
  const blocked = agedBody();
  const limited = await receiveContact(pool, blocked.body, {
    ip,
    send,
    shopEmail: 'info@otrace.co',
    now: blocked.now,
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.json.ok, false);
  assert.match(limited.json.error, /info@otrace\.co/);
  assert.equal(limited.json.error, CONTACT_RATE_MESSAGE);
  assert.equal(sent.length, 3);

  const bad = agedBody({ email: 'not-an-email' });
  const invalid = await receiveContact(pool, bad.body, {
    ip: '203.0.113.81',
    send,
    shopEmail: 'info@otrace.co',
    now: bad.now,
  });
  assert.equal(invalid.status, 400);
  assert.equal(sent.length, 3);
  resetRateLimits('contact');
});

test('turnstile is checked only when both keys are set', async () => {
  resetRateLimits('contact');
  const pool = memoryPool();
  const sent = [];
  const send = async () => {
    sent.push(1);
    return true;
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ success: false }) };
  };
  const open = agedBody();
  const skipped = await receiveContact(pool, open.body, {
    ip: '203.0.113.90',
    send,
    shopEmail: 'info@otrace.co',
    now: open.now,
    env: { TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '' },
    fetchImpl,
  });
  assert.equal(skipped.json.emailed, true);
  assert.equal(calls, 0);

  const closed = agedBody();
  const env = { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' };
  const missing = await receiveContact(pool, closed.body, {
    ip: '203.0.113.91',
    send,
    shopEmail: 'info@otrace.co',
    now: closed.now,
    env,
    fetchImpl,
  });
  assert.equal(missing.status, 400);
  assert.match(missing.json.error, /person/);
  assert.equal(calls, 0);
  assert.equal(sent.length, 1);

  const badToken = agedBody({ 'cf-turnstile-response': 'token-bad' });
  const refused = await receiveContact(pool, badToken.body, {
    ip: '203.0.113.93',
    send,
    shopEmail: 'info@otrace.co',
    now: badToken.now,
    env,
    fetchImpl,
  });
  assert.equal(refused.status, 400);
  assert.equal(calls, 1);
  assert.equal(sent.length, 1);

  const passed = agedBody({ 'cf-turnstile-response': 'token-ok' });
  const okFetch = async (_url, options) => {
    assert.match(String(options.body), /secret=secret/);
    assert.match(String(options.body), /response=token-ok/);
    return { ok: true, json: async () => ({ success: true }) };
  };
  const allowed = await receiveContact(pool, passed.body, {
    ip: '203.0.113.92',
    send,
    shopEmail: 'info@otrace.co',
    now: passed.now,
    env,
    fetchImpl: okFetch,
  });
  assert.equal(allowed.json.emailed, true);
  assert.equal(sent.length, 2);
  resetRateLimits('contact');
});

test('contact and ask-a-question forms carry the honeypot and the timestamp', async () => {
  const previousSite = process.env.TURNSTILE_SITE_KEY;
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    const contact = pageContent('contact').content;
    assert.match(contact, /name="otrace_hp"/);
    assert.match(contact, /tabindex="-1"/);
    assert.match(contact, /autocomplete="off"/);
    assert.match(contact, /class="otrace-hp"/);
    assert.match(contact, /name="otrace_ts"/);
    assert.match(contact, /otrace_ts:ts\?ts\.value:''/);
    assert.doesNotMatch(contact, /challenges\.cloudflare\.com/);

    const theme = await import('./theme/render-page.js').then(({ createThemeRenderer }) =>
      createThemeRenderer({
        themeRoot: fileURLToPath(new URL('../theme', import.meta.url)),
        siteUrl: 'https://otrace.co',
        assetBase: '/api/theme-assets',
        routesRoot: '/api/theme-preview/',
      }));
    const html = await theme.renderProduct(PRODUCTS['OT-HOOD']);
    const formAt = html.indexOf('id="ContactFormAsk"');
    const formEnd = html.indexOf('</form>', formAt);
    const form = html.slice(formAt, formEnd);
    assert.ok(formAt > 0 && formEnd > formAt);
    assert.match(form, /name="otrace_hp"/);
    assert.match(form, /tabindex="-1"/);
    assert.match(form, /autocomplete="off"/);
    assert.match(form, /class="otrace-hp"/);
    assert.match(form, /name="otrace_ts"/);
    assert.match(html, /payload\.otrace_ts/);
    assert.doesNotMatch(form, /cf-turnstile/);

    const css = fs.readFileSync(fileURLToPath(new URL('./theme/otrace-overrides.css', import.meta.url)), 'utf8');
    assert.match(css, /input\.otrace-hp\s*\{[^}]*position:\s*absolute\s*!important/);
    assert.match(css, /input\.otrace-hp\s*\{[^}]*left:\s*-10000px/);
  } finally {
    if (previousSite == null) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = previousSite;
    if (previousSecret == null) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previousSecret;
  }
});

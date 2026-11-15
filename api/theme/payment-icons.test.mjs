/**
 * Card icons are ours, and every name the theme can render has a file.
 *
 * Until 15 Nov 2026 the product page and both cart views hotlinked their
 * card icons from raw.githubusercontent.com. That is not a CDN, it
 * rate-limits, and it put a third-party request on the page where somebody
 * is deciding whether to type a card number. Two blocks also carried a
 * cdn.shopify.com lazyload placeholder, the only thing on this store still
 * loading from Shopify.
 *
 * The files live in site/public/brand/payment and are served by the
 * existing `location ^~ /brand/` nginx block, so there is no new route.
 *
 * The second half matters as much as the first: the theme builds the path
 * from the name in `block.settings.svg`, so a name with no file renders a
 * broken image, and a brand we do not accept is a false claim at the point
 * of payment. Kalles shipped defaults of 21 icons including bitcoin,
 * dogecoin, litecoin, klarna and paypal; Stripe settles six cards for us.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS } from '../catalog.js';
import { createThemeRenderer } from './render-page.js';

const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
const iconDir = fileURLToPath(new URL('../../site/public/brand/payment', import.meta.url));

const ACCEPTED = ['visa', 'master', 'american_express', 'discover', 'diners_club', 'jcb'];

const theme = createThemeRenderer({
  themeRoot, siteUrl: 'https://otrace.co',
  assetBase: '/api/theme-assets', routesRoot: '/',
});

/** Every .liquid and .json in the theme, so a new file cannot slip past. */
function themeFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'assets') walk(full);
      } else if (/\.(liquid|json)$/.test(entry.name)) out.push(full);
    }
  };
  walk(themeRoot);
  return out;
}

test('the six icons we accept are on disk and are real SVGs', () => {
  for (const name of ACCEPTED) {
    const file = path.join(iconDir, `${name}.svg`);
    assert.ok(fs.existsSync(file), `${name}.svg is missing`);
    const body = fs.readFileSync(file, 'utf8');
    assert.match(body, /<svg[\s>]/, `${name}.svg is not an SVG`);
    // Served from our own origin, so it must not carry active content.
    assert.doesNotMatch(body, /<script|\son[a-z]+\s*=|javascript:|<foreignObject/i, `${name}.svg has active content`);
  }
});

test('no payment markup in the theme points at another host', () => {
  const offenders = [];
  for (const file of themeFiles()) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/\ssrc="(https?:\/\/[^"]+)"/g)) {
      if (/payment|card/i.test(m[1])) offenders.push(`${path.basename(file)}: ${m[1].slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

/**
 * Every icon name any block can render resolves to a file. This is what
 * catches someone adding "paypal" to a list without a paypal.svg - and
 * catches the Kalles defaults coming back.
 */
test('every icon name configured anywhere in the theme has a file', () => {
  const missing = new Set();
  const seen = new Set();
  for (const file of themeFiles()) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/"(?:default|info|svg)"\s*:\s*"([a-z0-9_,\s-]*american_express[a-z0-9_,\s-]*)"/g)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim();
        if (!name || name.startsWith('cust4__')) continue;
        seen.add(name);
        if (!fs.existsSync(path.join(iconDir, `${name}.svg`))) {
          missing.add(`${name} (${path.basename(file)})`);
        }
      }
    }
  }
  assert.ok(seen.size > 0, 'found no icon lists at all - did the key change?');
  assert.deepEqual([...missing].sort(), [], 'icon names with no file');
});

test('the product page renders our own icons, and only cards we accept', async () => {
  const html = await theme.renderProduct(PRODUCTS['OT-HOOD']);
  const srcs = [...html.matchAll(/src="(\/brand\/payment\/[^"]+)"/g)].map((m) => m[1]);
  assert.equal(srcs.length, ACCEPTED.length, `rendered ${srcs.length} icons`);
  assert.deepEqual(
    [...srcs].sort(),
    ACCEPTED.map((n) => `/brand/payment/${n}.svg`).sort(),
  );
  for (const src of srcs) {
    assert.ok(fs.existsSync(path.join(iconDir, path.basename(src))), `${src} has no file`);
  }
  // No <img> anywhere on the page loads from somewhere else.
  const external = [...html.matchAll(/<img[^>]*\ssrc="(https?:\/\/(?!otrace\.co)[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, []);
});

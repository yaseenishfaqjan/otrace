import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, SET_TOTAL_CENTS } from '../catalog.js';
import { INDEXNOW_KEY } from '../indexnow.js';
import { publicBody, robotsTxt, sitemapXml, merchantFeedXml, INDEXABLE_PATHS } from './discovery.js';
import { pageContent, standalonePage, chatEmbed, klaviyoOnsite, whatsappHref, instagramHref } from './pages.js';
import { ENTITY_SUMMARY } from './seo.js';
import { swatchFor, shopifyColor, shopifyFont } from './shopify-color.js';
import { replaceOtraceServer, serverBlock } from '../../deploy/apply-nginx-routes.mjs';

const SITE = 'https://otrace.co';
const themeRoot = fileURLToPath(new URL('../../theme', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

let rendererPromise;
function renderer() {
  if (!rendererPromise) {
    rendererPromise = import('./render-page.js').then(({ createThemeRenderer }) =>
      createThemeRenderer({
        themeRoot,
        siteUrl: SITE,
        assetBase: '/api/theme-assets',
        routesRoot: '/api/theme-preview/',
      }));
  }
  return rendererPromise;
}

test('legal, journal and order pages are theme content, with the catalogue prices', () => {
  for (const handle of ['privacy', 'terms', 'shipping', 'about']) {
    const page = pageContent(handle);
    assert.ok(page?.content, handle);
    assert.equal(page.canonical_path, `/${handle}`);
  }
  const terms = pageContent('terms').content;
  assert.match(terms, /\$80\.00/);
  assert.match(terms, /\$100\.00/);
  assert.match(terms, /\$140\.00/);
  assert.doesNotMatch(terms, /\$148/);
  assert.doesNotMatch(pageContent('about').content, /sell out than discount/i);

  const order = standalonePage('order-success');
  assert.match(order.content, /confirmed/i);
  assert.equal(order.canonical_path, '/order/success');
  assert.equal(order.noindex, true);
});

test('discovery files name the AI crawlers, the pages, and the $80 singles', () => {
  const robots = robotsTxt(SITE);
  assert.match(robots, /GPTBot/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/otrace\.co\/sitemap\.xml/);
  assert.match(robots, /LLMs: https:\/\/otrace\.co\/llms\.txt/);

  const sitemap = sitemapXml(SITE, '2026-10-27');
  for (const route of ['/privacy', '/terms', '/shipping', '/blog', '/product/complete-set', '/blog/what-is-a-450-gsm-hoodie']) {
    assert.ok(sitemap.includes(`https://otrace.co${route}`), route);
    assert.ok(INDEXABLE_PATHS.includes(route), route);
  }

  const feed = merchantFeedXml(SITE);
  assert.match(feed, /<g:price>80\.00 USD<\/g:price>/);
  assert.doesNotMatch(feed, /<g:price>140\.00 USD<\/g:price>/);
  assert.doesNotMatch(feed, /OT-SET/);
  assert.equal(feed.match(/<g:id>/g).length, 2 * 2 * 7);

  const llms = publicBody('/llms.txt', SITE);
  assert.ok(llms?.body?.length, 'llms.txt is missing from seo/');
  assert.match(String(llms.body), /OTRACE/);
  const key = publicBody(`/${INDEXNOW_KEY}.txt`, SITE);
  assert.equal(String(key.body), INDEXNOW_KEY);
  const photo = publicBody('/products/hoodie-onyx-front.jpg', SITE);
  assert.ok(photo?.file?.endsWith('hoodie-onyx-front.jpg'));
  assert.equal(publicBody('/etc/passwd', SITE), null);
});

test('colour schemes, fonts and swatches come from theme settings', () => {
  const black = shopifyColor('#222222');
  assert.equal(black.rgb, '34 34 34');
  assert.equal(shopifyColor('#fff').rgb, '255 255 255');
  assert.equal(shopifyFont('poppins_n4').family, 'Poppins');
  assert.equal(shopifyFont('libre_baskerville_n4').family, 'Libre Baskerville');
  assert.equal(swatchFor('Onyx Black').color, '#161513');
  assert.equal(swatchFor('Warm Cream').color, '#efe6d2');
  assert.equal(swatchFor('Navy'), null);
});

test('the rendered theme uses scheme colours, Poppins, and a real cart banner', async () => {
  const theme = await renderer();
  const home = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
  assert.match(home, /--color-base-text:\s*34 34 34/);
  assert.match(home, /--color-base-background:\s*255 255 255/);
  assert.match(home, /--f_family_1:\s*Poppins, sans-serif/);
  assert.match(home, /--f_family_3:\s*Libre Baskerville, serif/);
  assert.match(home, /\[color-scheme="scheme-77e4ef58-56a9-4631-876a-12098ba7d57d"\][\s\S]*?--color-background:\s*34 34 34/);
  assert.match(home, /"@type":"Organization"/);
  assert.match(home, /index, follow/);
  assert.doesNotMatch(home, /name="robots" content="noindex/);
  assert.match(home, /\$140/);

  const cart = await theme.renderPage('cart', {
    cart: { items: [], item_count: 0, total_price: 0, items_subtotal_price: 0, original_total_price: 0, total_discount: 0, currency: 'USD', empty: true },
    title: 'Your cart',
    page_title: 'Your cart — OTRACE',
    noindex: true,
    canonical_path: '/cart',
  });
  assert.match(cart, /\/lookbook\/look-10-tall\.jpg/);
  assert.match(cart, /object-position:\s*center 32%/);
  assert.match(cart, /min-height:\s*clamp\(240px, 38vw, 480px\)/);
  const guardsAt = cart.indexOf('data-otrace-guards');
  const customAt = cart.indexOf('custom.js');
  assert.ok(guardsAt > 0 && customAt > guardsAt);
  assert.match(cart, /<script data-otrace-guards>[\s\S]*hdt-sticky-header[\s\S]*hdt-country-province-selector[\s\S]*hdt-slider-thumb[\s\S]*<\/script>/);
  assert.doesNotMatch(cart, /shopify:\/\//);
  assert.doesNotMatch(cart, /src="[^"]*amazon_payments/);
  assert.match(cart, /noindex, follow/);
});

test('a product page is indexable, swatched, and still $80', async () => {
  const theme = await renderer();
  const html = await theme.renderProduct(PRODUCTS['OT-HOOD']);
  assert.match(html, /--hdt-bg-color:\s*#161513/);
  assert.match(html, /--hdt-bg-color:\s*#efe6d2/);
  assert.match(html, /\$80\.00/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /"@type":"ProductGroup"/);
  assert.match(html, /"price":"80\.00"/);
  assert.match(html, /FAQPage|Questions/);
  assert.match(html, /index, follow/);
  assert.equal(Object.keys(PRODUCTS).sort().join(','), 'OT-HOOD,OT-PANT');
  assert.equal(SET_TOTAL_CENTS, 14000);
});

test('the complete set is a $140 page and not a third Stripe product', async () => {
  const page = standalonePage('complete-set');
  assert.match(page.content, /\$140\.00/);
  assert.match(page.content, /\$200\.00/);
  assert.match(page.content, /OT-HOOD-/);
  assert.match(page.content, /OT-PANT-/);
  assert.equal(page.canonical_path, '/product/complete-set');
  assert.equal(PRODUCTS['OT-SET'], undefined);

  const theme = await renderer();
  const html = await theme.renderPage('page', { ...page, json_ld: null }, 'page');
  assert.match(html, /Add the set — \$140\.00/);
  assert.match(html, /cart\/add\.js/);
});

test('account and wishlist say what they are, instead of sending people home', () => {
  const account = standalonePage('account');
  assert.match(account.content, /no sign-in/i);
  assert.match(account.content, /href="\/contact"/);
  assert.equal(account.noindex, true);

  const wishlist = standalonePage('wishlist');
  assert.match(wishlist.content, /this browser/i);
  assert.match(wishlist.content, /theme4:wishlist:id/);
  assert.match(wishlist.content, /\/product\/oversized-hoodie/);
  assert.doesNotMatch(wishlist.content, /isPageWishlist/);
});

test('chat, Klaviyo and WhatsApp stay off until a real env value is set', () => {
  const saved = { ...process.env };
  for (const key of [
    'WHATSAPP_NUMBER', 'PUBLIC_WHATSAPP_NUMBER', 'VITE_WHATSAPP_NUMBER',
    'INSTAGRAM_URL', 'VITE_INSTAGRAM_URL', 'VITE_INSTAGRAM',
    'KLAVIYO_COMPANY_ID', 'CRISP_WEBSITE_ID', 'TAWK_PROPERTY_ID', 'TAWK_WIDGET_ID',
  ]) delete process.env[key];
  try {
    assert.equal(whatsappHref(), '');
    assert.equal(instagramHref(), '');
    assert.equal(klaviyoOnsite(), '');
    assert.equal(chatEmbed(), '');
    process.env.WHATSAPP_NUMBER = 'not-a-number';
    assert.equal(whatsappHref(), '');
    process.env.WHATSAPP_NUMBER = '+1 (415) 555-0134';
    assert.equal(whatsappHref(), 'https://wa.me/14155550134');
    process.env.VITE_INSTAGRAM = 'https://evil.example/phish';
    assert.equal(instagramHref(), '');
    process.env.VITE_INSTAGRAM = 'otrace.studio';
    assert.equal(instagramHref(), 'https://instagram.com/otrace.studio');
    process.env.KLAVIYO_COMPANY_ID = 'pk_secret_key';
    assert.equal(klaviyoOnsite(), '');
    process.env.KLAVIYO_COMPANY_ID = 'Ab12Cd';
    assert.match(klaviyoOnsite(), /company_id=Ab12Cd/);
    process.env.CRISP_WEBSITE_ID = 'not a website';
    assert.equal(chatEmbed(), '');
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});

test('the entity sentence matches the React site and identity.json', () => {
  const entity = fs.readFileSync(path.join(repoRoot, 'site/src/lib/entity.ts'), 'utf8');
  const identity = JSON.parse(fs.readFileSync(path.join(repoRoot, 'seo/identity.json'), 'utf8'));
  assert.ok(entity.includes(ENTITY_SUMMARY));
  assert.equal(identity.description, ENTITY_SUMMARY);
});

test('the nginx route file does not proxy the storefront to the React container', () => {
  const conf = fs.readFileSync(path.join(repoRoot, 'deploy/nginx-theme-routes.conf'), 'utf8');
  assert.match(conf, /server_name otrace\.co;/);
  assert.match(conf, /privacy/);
  assert.match(conf, /\/order\/success/);
  assert.match(conf, /robots/);
  assert.doesNotMatch(conf, /proxy_pass[^;]*otrace-web/);
  assert.match(conf, /apply-nginx-routes/);
});

test('replacing the otrace server block keeps the inode and the other servers', () => {
  const block = serverBlock(fs.readFileSync(path.join(repoRoot, 'deploy/nginx-theme-routes.conf'), 'utf8'));
  const live = [
    'server { listen 80; server_name other.example; }',
    'server { listen 443 ssl; server_name otrace.co; location / { proxy_pass http://otrace-web:80; } }',
    'server { listen 443 ssl; server_name shop.example; }',
  ].join('\n');
  const next = replaceOtraceServer(live, block);
  assert.match(next, /server_name other\.example;/);
  assert.match(next, /server_name shop\.example;/);
  assert.match(next, /location ~ \^\/\(sizing\|garment-dyed/);
  assert.doesNotMatch(next, /proxy_pass[^;]*otrace-web/);

  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'otrace-nginx-')), 'nginx.conf');
  fs.writeFileSync(dest, live);
  const before = fs.statSync(dest).ino;
  const result = spawnSync(process.execPath, [
    path.join(repoRoot, 'deploy/apply-nginx-routes.mjs'),
    '--dest', dest,
    '--skip-reload',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.statSync(dest).ino, before);
  assert.match(fs.readFileSync(dest, 'utf8'), /\/product\/complete-set|complete-set|privacy/);
});

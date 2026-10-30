import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { PRODUCTS, SET_TOTAL_CENTS } from '../catalog.js';
import { INDEXNOW_KEY } from '../indexnow.js';
import { publicBody, robotsTxt, sitemapXml, merchantFeedXml, INDEXABLE_PATHS } from './discovery.js';
import { pageContent, standalonePage, chatEmbed, clarityProjectId, clarityTag, gaMeasurementId, googleTag, klaviyoOnsite, whatsappHref, instagramHref } from './pages.js';
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

test('product info modals carry the size chart, delivery copy, and a labeled question form', async () => {
  const theme = await renderer();
  const html = await theme.renderProduct(PRODUCTS['OT-HOOD']);
  const sizeAt = html.indexOf('id="modal-product_size_chart_6Y9gBm"');
  const deliveryAt = html.indexOf('id="modal-delivery-product_delivery_return_CqMf76"');
  assert.ok(sizeAt > 0 && deliveryAt > sizeAt);
  const size = html.slice(sizeAt, deliveryAt);
  assert.match(size, /Size guide/);
  assert.match(size, /Oversized hoodie/);
  assert.match(size, /<th scope="row">Chest<\/th>/);
  assert.match(size, /<span class="hdt-size-cm">40<\/span>/);
  assert.match(size, /Body length/);
  assert.match(size, /Sleeve \/ waist/);
  assert.match(size, /Wide-leg sweatpant/);
  assert.match(size, /centimetres/);
  assert.doesNotMatch(size, /\$80/);

  const delivery = html.slice(deliveryAt, html.indexOf('modal-contactFormAsk', deliveryAt));
  assert.match(delivery, /Delivery and returns/);
  assert.match(delivery, /free inside the United States/);
  assert.match(delivery, /30 days of delivery/);
  assert.match(delivery, /href="\/shipping"/);

  const formAt = html.lastIndexOf('<form', html.indexOf('id="ContactFormAsk"'));
  const ask = html.slice(formAt, html.indexOf('otrace-ask-note') + 40);
  assert.match(ask, /action="\/api\/contact"/);
  assert.match(ask, />Name</);
  assert.match(ask, />Email</);
  assert.match(ask, /Phone/);
  assert.match(ask, /optional/);
  assert.match(ask, /mailto:info@otrace\.co/);
  assert.match(ask, /name="contact\[body\]"/);
  assert.doesNotMatch(ask, /name="contact\[product\]"[^>]*required/);
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
  // Both colourways are in the gallery. Onyx is the first option, so it is
  // the pair on screen until the dropdown names Warm Cream.
  assert.match(page.content, /data-set-colour="Onyx Black"/);
  assert.match(page.content, /data-set-colour="Warm Cream" hidden/);
  assert.match(page.content, /\/products\/hoodie-onyx-front\.jpg/);
  assert.match(page.content, /\/products\/pant-onyx-front\.jpg/);
  assert.match(page.content, /\/products\/hoodie-cream-front\.jpg/);
  assert.match(page.content, /\/products\/pant-cream-front\.jpg/);
  assert.match(page.content, /showColour/);
  assert.match(page.content, /<label>Color<select name="colour"/);
  assert.doesNotMatch(page.content, /<label>Colour/);
  assert.doesNotMatch(page.content, /data-set-colour="Onyx Black" hidden/);

  const theme = await renderer();
  const html = await theme.renderPage('page', { ...page, json_ld: null }, 'page');
  assert.match(html, /Add the set — \$140\.00/);
  assert.match(html, /cart\/add\.js/);
  assert.match(html, /<img[^>]*src="[^"]*hoodie-cream-front\.jpg"/);
  assert.match(html, /<img[^>]*src="[^"]*pant-cream-front\.jpg"/);
  assert.match(html, /data-set-colour="Warm Cream" hidden/);
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

const GA_ID = 'G-KZZXSSF3L1';
const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>`;
const CLARITY_ID = 'z3xvl8jv8y';
const CLARITY_SNIPPET = `<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${CLARITY_ID}");
</script>`;

function countOf(html, needle) {
  return html.split(needle).length - 1;
}

test('chat, Klaviyo and WhatsApp stay off until a real env value is set', () => {
  const saved = { ...process.env };
  for (const key of [
    'WHATSAPP_NUMBER', 'PUBLIC_WHATSAPP_NUMBER', 'VITE_WHATSAPP_NUMBER',
    'INSTAGRAM_URL', 'VITE_INSTAGRAM_URL', 'VITE_INSTAGRAM',
    'KLAVIYO_COMPANY_ID', 'CRISP_WEBSITE_ID', 'TAWK_PROPERTY_ID', 'TAWK_WIDGET_ID',
    'GA_MEASUREMENT_ID', 'OTRACE_GA_MEASUREMENT_ID',
    'CLARITY_PROJECT_ID', 'OTRACE_CLARITY_PROJECT_ID',
  ]) delete process.env[key];
  try {
    assert.equal(whatsappHref(), '');
    assert.equal(instagramHref(), '');
    assert.equal(klaviyoOnsite(), '');
    assert.equal(chatEmbed(), '');
    assert.equal(gaMeasurementId(), '');
    assert.equal(googleTag(), '');
    assert.equal(clarityProjectId(), '');
    assert.equal(clarityTag(), '');
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
    process.env.GA_MEASUREMENT_ID = 'GTM-KZZXSSF3';
    assert.equal(googleTag(), '', 'a GTM container id is not a second tag');
    process.env.GA_MEASUREMENT_ID = 'G-KZZXSSF3L1"><script>';
    assert.equal(googleTag(), '');
    delete process.env.GA_MEASUREMENT_ID;
    process.env.OTRACE_GA_MEASUREMENT_ID = 'g-kzzxssf3l1';
    assert.equal(googleTag(), GA_SNIPPET);
    process.env.GA_MEASUREMENT_ID = GA_ID;
    process.env.OTRACE_GA_MEASUREMENT_ID = 'G-OTHERID99';
    assert.equal(gaMeasurementId(), GA_ID);
    assert.equal(countOf(googleTag(), 'googletagmanager.com/gtag/js'), 1);
    assert.equal(countOf(googleTag(), `gtag('config', '${GA_ID}')`), 1);
    process.env.CLARITY_PROJECT_ID = 'z3xvl8jv8y";alert(1);//';
    assert.equal(clarityTag(), '');
    delete process.env.CLARITY_PROJECT_ID;
    process.env.OTRACE_CLARITY_PROJECT_ID = 'Z3XVL8JV8Y';
    assert.equal(clarityTag(), CLARITY_SNIPPET);
    process.env.CLARITY_PROJECT_ID = CLARITY_ID;
    process.env.OTRACE_CLARITY_PROJECT_ID = 'otherid1234';
    assert.equal(clarityProjectId(), CLARITY_ID);
    assert.equal(countOf(clarityTag(), 'https://www.clarity.ms/tag/'), 1);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
});

function assertGoogleTag(html, { present, marker }) {
  const headStart = html.indexOf('<head>');
  const headEnd = html.indexOf('</head>');
  assert.ok(headStart >= 0 && headEnd > headStart, marker);
  const head = html.slice(headStart, headEnd);
  const src = `googletagmanager.com/gtag/js?id=${GA_ID}`;
  const config = `gtag('config', '${GA_ID}')`;
  assert.match(html, marker);
  if (!present) {
    assert.equal(countOf(html, 'googletagmanager.com/gtag'), 0, marker);
    assert.equal(countOf(html, 'dataLayer'), 0, marker);
    assert.equal(countOf(html, 'function gtag()'), 0, marker);
    assert.equal(countOf(html, 'clarity.ms'), 0, marker);
    return;
  }
  assert.equal(html.slice(headStart, headStart + '<head>\n'.length + GA_SNIPPET.length), `<head>\n${GA_SNIPPET}`, marker);
  assert.equal(countOf(html, src), 1, marker);
  assert.equal(countOf(head, src), 1, marker);
  assert.equal(countOf(html, config), 1, marker);
  assert.equal(countOf(html, 'function gtag()'), 1, marker);
  assert.equal(countOf(html, 'window.dataLayer = window.dataLayer || []'), 1, marker);
  assert.equal(countOf(html, 'googletagmanager.com/gtm.js'), 0, marker);
}

function assertClarity(html, { present }) {
  const headStart = html.indexOf('<head>');
  const headEnd = html.indexOf('</head>');
  const head = html.slice(headStart, headEnd);
  const src = `https://www.clarity.ms/tag/"+i`;
  const idArg = `"script", "${CLARITY_ID}"`;
  if (!present) {
    assert.equal(countOf(html, 'clarity.ms'), 0);
    return;
  }
  assert.equal(countOf(html, src), 1);
  assert.equal(countOf(head, src), 1);
  assert.equal(countOf(html, idArg), 1);
  assert.equal(countOf(html, 'function(c,l,a,r,i,t,y)'), 1);
}

test('GA4 and Clarity tags share the head slot, one each, and stay off when blank', async () => {
  const saved = { ...process.env };
  delete process.env.GA_MEASUREMENT_ID;
  delete process.env.OTRACE_GA_MEASUREMENT_ID;
  delete process.env.CLARITY_PROJECT_ID;
  delete process.env.OTRACE_CLARITY_PROJECT_ID;
  const theme = await renderer();
  const pages = async () => {
    const home = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
    const shop = await theme.renderCollection({
      handle: 'all',
      title: 'AW2026',
      products: Object.values(PRODUCTS),
    });
    const pdp = await theme.renderProduct(PRODUCTS['OT-HOOD']);
    return [
      [home, /rel="canonical" href="https:\/\/otrace\.co\/?"/],
      [shop, /rel="canonical" href="https:\/\/otrace\.co\/shop"/],
      [pdp, /rel="canonical" href="https:\/\/otrace\.co\/product\/oversized-hoodie"/],
    ];
  };
  try {
    const bare = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
    assertGoogleTag(bare, { present: false, marker: /rel="canonical" href="https:\/\/otrace\.co\/?"/ });

    process.env.GA_MEASUREMENT_ID = GA_ID;
    for (const [html, marker] of await pages()) {
      assertGoogleTag(html, { present: true, marker });
      assertClarity(html, { present: false });
    }

    process.env.CLARITY_PROJECT_ID = CLARITY_ID;
    for (const [html, marker] of await pages()) {
      assertGoogleTag(html, { present: true, marker });
      assertClarity(html, { present: true });
      const headStart = html.indexOf('<head>');
      const block = `<head>\n${GA_SNIPPET}\n${CLARITY_SNIPPET}`;
      assert.equal(html.slice(headStart, headStart + block.length), block);
    }

    delete process.env.GA_MEASUREMENT_ID;
    delete process.env.OTRACE_GA_MEASUREMENT_ID;
    const clarityOnly = await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE — AW2026' }, 'index');
    assert.equal(countOf(clarityOnly, 'googletagmanager.com/gtag'), 0);
    assert.equal(
      clarityOnly.slice(clarityOnly.indexOf('<head>'), clarityOnly.indexOf('<head>') + '<head>\n'.length + CLARITY_SNIPPET.length),
      `<head>\n${CLARITY_SNIPPET}`,
    );
    assertClarity(clarityOnly, { present: true });
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

test('lookbook answers on /lookbook and /lookbook/ and still serves a frame', async () => {
  const { mountStorefront } = await import('./mount-storefront.js');
  const theme = await renderer();
  const app = express();
  app.set('strict routing', true);
  mountStorefront(app, {
    themeRenderer: theme,
    siteUrl: SITE,
    sendThemeHtml: (res, html) => {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    },
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/lookbook', '/lookbook/']) {
      const res = await fetch(base + route);
      const html = await res.text();
      assert.equal(res.status, 200, route);
      assert.doesNotMatch(html, /Cannot GET/);
      assert.match(html, /hdt-lookbook-grid/);
      assert.match(html, /href="\/lookbook"/);
      assert.match(html, /\/lookbook\/look-10-tall\.jpg/);
    }
    const photo = await fetch(base + '/lookbook/look-10-tall.jpg');
    const bytes = Buffer.from(await photo.arrayBuffer());
    assert.equal(photo.status, 200);
    assert.match(photo.headers.get('content-type') || '', /image/);
    assert.ok(bytes.length > 1000);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
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

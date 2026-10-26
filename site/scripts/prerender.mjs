/**
 * Prerender every page to static HTML, then write the SEO files.
 *
 * The storefront is a client-rendered React app: without this, a crawler or a
 * link-preview bot that does not run JavaScript receives an empty <div id="root">.
 * After `vite build`, this script:
 *
 *   1. serves the build with the SPA shell as fallback (scripts/serve.mjs),
 *   2. crawls the site in real Chrome from a seed list, following internal links,
 *   3. saves each page's rendered HTML — title, meta, canonical, JSON-LD and the
 *      visible content — as <route>.html (served by nginx's `$uri.html`),
 *   4. snapshots an unknown URL as 404.html (served with a real 404 status),
 *   5. writes sitemap.xml (indexable pages + their images), robots.txt and a
 *      Google Merchant Center product feed built from the product JSON-LD, so
 *      the feed can never disagree with what the product pages publish.
 *
 * The client hydrates the snapshot in place (src/main.tsx), so the first paint
 * is kept and every animation and interaction still works.
 *
 *   VITE_SITE_URL=https://otrace.com CHROME_PATH=... node scripts/prerender.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer, DIST } from './serve.mjs';
import { copyDiscovery, robotsTxt } from './seo-public.mjs';

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://otrace.co').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH
  ?? (fs.existsSync('/usr/bin/google-chrome')
    ? '/usr/bin/google-chrome'
    : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const PORT = 5199;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const NOT_FOUND_PROBE = '/__otrace-not-found__';

// Pages nothing links to directly (utility pages) plus the main entry points.
// Products and categories are discovered by following links, so a new product
// is prerendered without touching this file.
const SEEDS = ['/', '/shop', '/lookbook', '/about', '/sizing', '/garment-dyed', '/blog', '/contact', '/shipping', '/terms', '/privacy', '/cart', '/account', '/order/success'];

const shellPath = path.join(DIST, 'index.html');
const shell = fs.readFileSync(shellPath, 'utf8');
if (shell.includes('data-prerendered')) {
  console.error('dist/public/index.html is already prerendered. Run `vite build` first (npm run build does both).');
  process.exit(1);
}

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const outFile = (route) => path.join(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`);

const server = createServer({ fallbackHtml: shell });
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function snapshot(route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(ORIGIN + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 400));

  const data = await page.evaluate(() => {
    const root = document.documentElement;
    const links = [...document.querySelectorAll('a[href^="/"]')]
      .map((a) => a.getAttribute('href').split(/[?#]/)[0])
      .filter((href) => href && !href.startsWith('/api') && !/\.[a-z0-9]+$/i.test(href));
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent);
    const images = [...document.querySelectorAll('main img')].map((img) => img.getAttribute('src')).filter((src) => src && src.startsWith('/'));

    // Make the snapshot readable without JavaScript: reveal-on-scroll content is
    // hidden only under html.js-reveal until marked .in-view, so mark it all.
    // (When the app boots it re-renders these nodes and animates them as usual.)
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));

    // Hydration needs React's text boundaries. The live DOM holds ` (`, `0`, `)`
    // as three text nodes, but serialising merges them into " (0)" and React
    // then rejects the whole page (error #418) and re-renders it. React's own
    // server renderer separates adjacent text with <!-- -->; do the same.
    const appRoot = document.getElementById('root');
    const walker = document.createTreeWalker(appRoot, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (node.nextSibling && node.nextSibling.nodeType === Node.TEXT_NODE) node.after(document.createComment(' '));
    }
    root.classList.remove('snap-looks');
    // The web font stylesheet flips itself to media="all" once loaded; save it as
    // the non-blocking media="print" the page ships with (see index.html).
    document.querySelectorAll('link[data-async-css]').forEach((link) => link.setAttribute('media', 'print'));
    root.setAttribute('data-prerendered', '');

    return { links, robots, ld, images, title: document.title, html: `<!doctype html>\n${root.outerHTML}` };
  });
  await page.close();
  if (errors.length) throw new Error(`${route}: page errors while prerendering: ${errors.join(' | ')}`);
  return data;
}

const seen = new Set();
const queue = [...SEEDS];
const pages = [];
while (queue.length) {
  const route = queue.shift();
  if (seen.has(route)) continue;
  seen.add(route);
  if (seen.size > 200) throw new Error('crawl exceeded 200 pages — check for a link loop');

  const data = await snapshot(route);
  pages.push({ route, ...data });
  for (const link of data.links) if (!seen.has(link)) queue.push(link);
}

// Unknown URL → the app's NotFound page, saved as 404.html.
const notFound = await snapshot(NOT_FOUND_PROBE);

await browser.close();
server.close();

// ------------------------------------------------------------------ write
for (const p of pages) {
  const file = outFile(p.route);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, p.html);
}
fs.writeFileSync(path.join(DIST, '404.html'), notFound.html);

const today = new Date().toISOString().slice(0, 10);
const indexable = pages.filter((p) => !/noindex/i.test(p.robots) && !/not found/i.test(p.title));

const urlEntries = indexable
  .map((p) => {
    const images = [...new Set(p.images)].slice(0, 20);
    const imageXml = images.map((src) => `\n    <image:image><image:loc>${escapeXml(SITE_URL + src)}</image:loc></image:image>`).join('');
    const priority = p.route === '/' ? '1.0' : p.route.startsWith('/product/') ? '0.9' : p.route.startsWith('/shop') || p.route === '/lookbook' ? '0.8' : '0.5';
    return `  <url>\n    <loc>${escapeXml(SITE_URL + (p.route === '/' ? '/' : p.route))}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>${imageXml}\n  </url>`;
  })
  .join('\n');
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlEntries}\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml);
const lastmods = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
if (lastmods.length === 0 || lastmods.some((day) => day !== today)) {
  throw new Error(`sitemap lastmod check failed: expected ${today}, got ${lastmods.join(',') || '(none)'}`);
}

// noindex pages stay crawlable so search engines can SEE the noindex; only the API is off limits.
const robots = robotsTxt(SITE_URL);
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots);
if (
  !robots.includes('User-agent: GPTBot') ||
  !robots.includes('User-agent: Bingbot') ||
  !robots.includes(`LLMs: ${SITE_URL}/llms.txt`) ||
  !robots.includes(`Discovery: ${SITE_URL}/identity.json`) ||
  !robots.includes('Disallow: /api/')
) {
  throw new Error('robots.txt is missing the AI crawler block, Discovery line, or the API disallow');
}

copyDiscovery(DIST);

// Google Merchant Center feed (free product listings), one item per colour and size.
const feedItems = [];
// A pre-order offer must carry an availability date. Only variants whose
// schema availability is PreOrder get one; in-stock variants do not.
const availabilityDate = new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10) + 'T00:00:00Z';
for (const p of pages.filter((pg) => pg.route.startsWith('/product/'))) {
  // usePageMeta writes a page's structured data as one array; flatten it.
  const blocks = p.ld.flatMap((s) => [].concat(JSON.parse(s)));
  const group = blocks.find((b) => b['@type'] === 'ProductGroup');
  if (!group) continue;
  const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  const productType = crumbs?.itemListElement?.[2]?.name ?? '';
  for (const v of group.hasVariant) {
    const [main, ...extra] = v.image;
    const offer = v.offers;
    feedItems.push(`    <item>
      <g:id>${escapeXml(v.sku)}</g:id>
      <g:item_group_id>${escapeXml(group.productGroupID)}</g:item_group_id>
      <title>${escapeXml(`${SITE_URL.includes('otrace') ? 'OTRACE ' : ''}${group.name} — ${v.color} — ${v.size}`)}</title>
      <description>${escapeXml(group.description)}</description>
      <link>${escapeXml(offer.url)}</link>
      <g:image_link>${escapeXml(main)}</g:image_link>${extra.map((src) => `\n      <g:additional_image_link>${escapeXml(src)}</g:additional_image_link>`).join('')}
      <g:availability>${offer.availability.endsWith('PreOrder') ? 'preorder' : 'in_stock'}</g:availability>${offer.availability.endsWith('PreOrder') ? `\n      <g:availability_date>${availabilityDate}</g:availability_date>` : ''}
      <g:price>${escapeXml(`${offer.price} ${offer.priceCurrency}`)}</g:price>
      <g:brand>${escapeXml(group.brand.name)}</g:brand>
      <g:condition>new</g:condition>
      <g:color>${escapeXml(v.color)}</g:color>
      <g:size>${escapeXml(v.size)}</g:size>
      <g:gender>unisex</g:gender>
      <g:age_group>adult</g:age_group>
      <g:material>${escapeXml(group.material)}</g:material>
      <g:product_type>${escapeXml(productType)}</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:price>0.00 USD</g:price>
      </g:shipping>
    </item>`);
  }
}
fs.writeFileSync(
  path.join(DIST, 'merchant-feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>OTRACE</title>\n    <link>${escapeXml(SITE_URL)}</link>\n    <description>OTRACE product feed</description>\n${feedItems.join('\n')}\n  </channel>\n</rss>\n`,
);

console.log(`prerendered ${pages.length} pages + 404.html for ${SITE_URL}`);
for (const p of pages) console.log(`  ${/noindex/i.test(p.robots) ? 'noindex' : 'index  '}  ${p.route.padEnd(30)} ${p.title}`);
console.log(`sitemap.xml: ${indexable.length} urls | robots.txt | merchant-feed.xml: ${feedItems.length} items`);

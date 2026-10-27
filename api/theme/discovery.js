/**
 * Public discovery files the API serves so the storefront does not need the
 * React build. robots.txt, sitemap.xml and merchant-feed.xml are generated
 * from the catalogue. The prose files are read from seo/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, SIZES, SHIPPING, formatMoney } from '../catalog.js';
import { INDEXNOW_KEY } from '../indexnow.js';
import { POSTS } from '../../site/src/content/posts.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
export const PUBLIC_DIR = path.join(REPO, 'site', 'public');
export const SEO_DIR = path.join(REPO, 'seo');

export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
];

export function robotsTxt(siteUrl) {
  const origin = String(siteUrl).replace(/\/$/, '');
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /api/', ''];
  for (const bot of AI_CRAWLERS) {
    lines.push(`User-agent: ${bot}`, 'Allow: /', 'Disallow: /api/', '');
  }
  lines.push(
    `LLMs: ${origin}/llms.txt`,
    `Discovery: ${origin}/identity.json`,
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  );
  return lines.join('\n');
}

export const INDEXABLE_PATHS = [
  '/',
  '/shop',
  '/shop/hoodies',
  '/shop/bottoms',
  '/product/oversized-hoodie',
  '/product/wide-leg-sweatpant',
  '/product/complete-set',
  '/lookbook',
  '/garment-dyed',
  '/sizing',
  '/shipping',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/blog',
  ...POSTS.map((post) => `/blog/${post.slug}`),
];

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function productImages(product) {
  const images = [];
  for (const colorway of product.colorways ?? []) {
    for (const image of colorway.images ?? []) {
      if (image?.src) images.push(image.src);
    }
  }
  if (!images.length && product.image) images.push(product.image);
  return images;
}

export function sitemapXml(siteUrl, today = new Date().toISOString().slice(0, 10)) {
  const origin = String(siteUrl).replace(/\/$/, '');
  const urls = INDEXABLE_PATHS.map((route) => {
    const product = Object.values(PRODUCTS).find((item) => route === `/product/${item.slug}`);
    const images = product ? productImages(product).slice(0, 20) : [];
    const imageXml = images
      .map((src) => `\n    <image:image><image:loc>${escapeXml(origin + src)}</image:loc></image:image>`)
      .join('');
    const priority = route === '/' ? '1.0'
      : route.startsWith('/product/') ? '0.9'
        : route.startsWith('/shop') || route === '/lookbook' ? '0.8'
          : '0.5';
    const loc = route === '/' ? `${origin}/` : `${origin}${route}`;
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>${imageXml}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

const colorHandle = (name) => name.toLowerCase().replace(/\s+/g, '-');

/**
 * Merchant feed lists the two pieces at their single prices.
 * The $140 set is a basket rule, not a third SKU, so it is not a feed item.
 */
export function merchantFeedXml(siteUrl) {
  const origin = String(siteUrl).replace(/\/$/, '');
  const items = [];
  for (const product of Object.values(PRODUCTS)) {
    const price = `${(product.priceCents / 100).toFixed(2)} USD`;
    const material = 'Cotton';
    const productType = product.sku === 'OT-HOOD' ? 'Hoodies' : 'Bottoms';
    for (const colorway of product.colorways ?? []) {
      const images = (colorway.images ?? []).map((image) => `${origin}${image.src}`);
      const [main, ...extra] = images.length ? images : [`${origin}${product.image}`];
      for (const size of product.sizes ?? SIZES) {
        const id = `${product.sku}-${colorHandle(colorway.name)}-${size}`.toUpperCase();
        const extraXml = extra
          .map((src) => `\n      <g:additional_image_link>${escapeXml(src)}</g:additional_image_link>`)
          .join('');
        items.push(`    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:item_group_id>${escapeXml(product.sku)}</g:item_group_id>
      <title>${escapeXml(`${product.name} — ${colorway.name} — ${size}`)}</title>
      <description>${escapeXml(product.description)}</description>
      <link>${escapeXml(`${origin}/product/${product.slug}`)}</link>
      <g:image_link>${escapeXml(main)}</g:image_link>${extraXml}
      <g:availability>in_stock</g:availability>
      <g:price>${escapeXml(price)}</g:price>
      <g:brand>OTRACE</g:brand>
      <g:condition>new</g:condition>
      <g:color>${escapeXml(colorway.name)}</g:color>
      <g:size>${escapeXml(size)}</g:size>
      <g:gender>unisex</g:gender>
      <g:age_group>adult</g:age_group>
      <g:material>${escapeXml(material)}</g:material>
      <g:product_type>${escapeXml(productType)}</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>${escapeXml(SHIPPING.label)}</g:service>
        <g:price>0.00 USD</g:price>
      </g:shipping>
    </item>`);
      }
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>OTRACE</title>\n    <link>${escapeXml(origin)}</link>\n    <description>OTRACE product feed. Single pieces are ${formatMoney(PRODUCTS['OT-HOOD'].priceCents)} each. A hoodie and a sweatpant together are priced in the cart.</description>\n${items.join('\n')}\n  </channel>\n</rss>\n`;
}

const TEXT_FILES = {
  '/llms.txt': ['llms.txt', 'text/plain; charset=utf-8'],
  '/llms-full.txt': ['llms-full.txt', 'text/plain; charset=utf-8'],
  '/ai.txt': ['ai.txt', 'text/plain; charset=utf-8'],
  '/faq-ai.txt': ['faq-ai.txt', 'text/plain; charset=utf-8'],
  '/identity.json': ['identity.json', 'application/json; charset=utf-8'],
};

const MARKDOWN = {
  '/index.md': 'pages/index.md',
  '/about.md': 'pages/about.md',
  '/sizing.md': 'pages/sizing.md',
  '/garment-dyed.md': 'pages/garment-dyed.md',
  '/shipping.md': 'pages/shipping.md',
  '/product/oversized-hoodie.md': 'pages/product/oversized-hoodie.md',
  '/product/wide-leg-sweatpant.md': 'pages/product/wide-leg-sweatpant.md',
  '/blog/index.md': 'pages/blog/index.md',
  '/llms/pages/index.md': 'pages/index.md',
  '/llms/pages/about.md': 'pages/about.md',
  '/llms/pages/sizing.md': 'pages/sizing.md',
  '/llms/pages/garment-dyed.md': 'pages/garment-dyed.md',
  '/llms/pages/shipping.md': 'pages/shipping.md',
  '/llms/pages/oversized-hoodie.md': 'pages/product/oversized-hoodie.md',
  '/llms/pages/wide-leg-sweatpant.md': 'pages/product/wide-leg-sweatpant.md',
  '/llms/pages/journal.md': 'pages/blog/index.md',
};

for (const post of POSTS) {
  MARKDOWN[`/blog/${post.slug}.md`] = `pages/blog/${post.slug}.md`;
  MARKDOWN[`/llms/pages/${post.slug}.md`] = `pages/blog/${post.slug}.md`;
}

const ROOT_ASSET = /^(favicon(?:-\d+)?\.(?:svg|png|ico)|apple-touch-icon\.png|icon-512\.png|og\.(?:jpg|webp)|campaign\.(?:jpg|webp)|detail-[\w-]+\.(?:jpe?g|webp)|hero-[\w-]+\.(?:jpe?g|webp))$/;
const PREFIXES = ['products/', 'brand/', 'lookbook/', 'email/', 'turntable/'];

export function resolveStaticFile(urlPath) {
  let rel = '';
  try {
    rel = decodeURIComponent(String(urlPath || '')).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!rel || rel.includes('..') || rel.includes('\\') || rel.includes('\0')) return null;
  const allowed = ROOT_ASSET.test(rel) || PREFIXES.some((prefix) => rel.startsWith(prefix));
  if (!allowed) return null;
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

function readSeo(rel) {
  const file = path.resolve(SEO_DIR, rel);
  if (!file.startsWith(SEO_DIR + path.sep) && file !== SEO_DIR) return null;
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

/**
 * A generated or copied public body, or null when this path is not ours.
 * `file` is a path express can sendFile. `body` is a generated string.
 */
export function publicBody(urlPath, siteUrl) {
  const pathOnly = String(urlPath || '').split('?')[0];
  const text = TEXT_FILES[pathOnly];
  if (text) {
    const body = readSeo(text[0]);
    if (!body) return null;
    return { body, type: text[1] };
  }
  const markdown = MARKDOWN[pathOnly];
  if (markdown) {
    const body = readSeo(markdown);
    if (!body) return null;
    return { body, type: 'text/markdown; charset=utf-8' };
  }
  if (pathOnly === '/robots.txt') return { body: robotsTxt(siteUrl), type: 'text/plain; charset=utf-8' };
  if (pathOnly === '/sitemap.xml') return { body: sitemapXml(siteUrl), type: 'application/xml; charset=utf-8' };
  if (pathOnly === '/merchant-feed.xml') return { body: merchantFeedXml(siteUrl), type: 'application/xml; charset=utf-8' };
  if (pathOnly === `/${INDEXNOW_KEY}.txt`) return { body: INDEXNOW_KEY, type: 'text/plain; charset=utf-8' };
  const file = resolveStaticFile(pathOnly);
  if (file) return { file };
  return null;
}

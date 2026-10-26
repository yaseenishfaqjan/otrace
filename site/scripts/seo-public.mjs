/**
 * Files the build copies onto the public origin.
 * seo/llms.txt is the source. robots.txt is generated here so the prerender
 * and the seo/ mirror cannot diverge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDiscovery } from '../../seo/build-discovery.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');
export const LLMS_SOURCE = path.join(REPO_ROOT, 'seo', 'llms.txt');
export const PUBLIC_DIR = path.join(REPO_ROOT, 'site', 'public');

export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bingbot',
];

/** seo-relative source → path under the public root. */
export const DISCOVERY_FILES = [
  ['seo/llms.txt', 'llms.txt'],
  ['seo/llms-full.txt', 'llms-full.txt'],
  ['seo/identity.json', 'identity.json'],
  ['seo/ai.txt', 'ai.txt'],
  ['seo/faq-ai.txt', 'faq-ai.txt'],
  ['seo/pages/index.md', 'index.md'],
  ['seo/pages/about.md', 'about.md'],
  ['seo/pages/sizing.md', 'sizing.md'],
  ['seo/pages/garment-dyed.md', 'garment-dyed.md'],
  ['seo/pages/shipping.md', 'shipping.md'],
  ['seo/pages/product/oversized-hoodie.md', 'product/oversized-hoodie.md'],
  ['seo/pages/product/wide-leg-sweatpant.md', 'product/wide-leg-sweatpant.md'],
];

/**
 * Named bots do not inherit the `User-agent: *` group, so each one repeats
 * Disallow: /api/. Allow: / is the explicit AI permission from the brief.
 */
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

export function copyDiscovery(destDir) {
  for (const [rel, out] of DISCOVERY_FILES) {
    const src = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(src)) throw new Error(`missing discovery source ${rel}`);
    const dest = path.join(destDir, out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export function indexNowKey() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'indexnow.js'), 'utf8');
  const match = src.match(/INDEXNOW_KEY = '([0-9a-f]{8,128})'/);
  if (!match) throw new Error('INDEXNOW_KEY missing from api/indexnow.js');
  return match[1];
}

/** Regenerate companion files, then copy them and the IndexNow key into site/public. */
export function syncPublicSeo() {
  buildDiscovery();
  const llms = fs.readFileSync(LLMS_SOURCE, 'utf8');
  for (const needle of ['> OTRACE sells', '## What We Do Not Do', '## Contact', '## AI Discovery Files', 'info@otrace.co']) {
    if (!llms.includes(needle)) throw new Error(`seo/llms.txt missing ${needle}`);
  }
  const full = fs.readFileSync(path.join(REPO_ROOT, 'seo', 'llms-full.txt'), 'utf8');
  if (!full.includes('148 USD') || !full.includes('450 GSM')) {
    throw new Error('seo/llms-full.txt is missing required facts');
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  copyDiscovery(PUBLIC_DIR);
  const key = indexNowKey();
  fs.writeFileSync(path.join(PUBLIC_DIR, `${key}.txt`), key);
  fs.writeFileSync(path.join(REPO_ROOT, 'seo', 'robots.txt'), robotsTxt('https://otrace.co'));
  return { key, llmsBytes: Buffer.byteLength(llms) };
}

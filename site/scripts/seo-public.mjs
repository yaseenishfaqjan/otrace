/**
 * Files the build copies onto the public origin.
 * seo/llms.txt is the source. robots.txt is generated here so the prerender
 * and the seo/ mirror cannot diverge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  lines.push(`LLMs: ${origin}/llms.txt`, '', `Sitemap: ${origin}/sitemap.xml`, '');
  return lines.join('\n');
}

export function indexNowKey() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'api', 'indexnow.js'), 'utf8');
  const match = src.match(/INDEXNOW_KEY = '([0-9a-f]{8,128})'/);
  if (!match) throw new Error('INDEXNOW_KEY missing from api/indexnow.js');
  return match[1];
}

/** Copy llms.txt and the IndexNow key file into site/public (Vite then copies them to dist). */
export function syncPublicSeo() {
  const llms = fs.readFileSync(LLMS_SOURCE);
  if (!llms.includes('450 GSM') || !llms.includes('148 USD')) {
    throw new Error('seo/llms.txt is missing required facts');
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), llms);
  const key = indexNowKey();
  fs.writeFileSync(path.join(PUBLIC_DIR, `${key}.txt`), key);
  fs.writeFileSync(path.join(REPO_ROOT, 'seo', 'robots.txt'), robotsTxt('https://otrace.co'));
  return { key, llmsBytes: llms.length };
}

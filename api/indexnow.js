/**
 * IndexNow submission for Bing and Yandex.
 *
 * The key is an ownership token, not a credential: it is served in public at
 * https://otrace.co/<key>.txt and is useless without that file. Notes live in
 * seo/indexnow.md. Do not move the key into an env secret or the public file
 * and this constant will drift.
 *
 * CLI (after the new static files are on the live host):
 *   node api/indexnow.js
 * Exit 0 only when IndexNow accepts the URL list. The API process also calls
 * submitIndexNow on boot and logs the result without taking checkout down.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INDEXNOW_KEY = '32dfcb834125ce46de389d323db4c3b0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function urlsFromSitemap(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

export function indexNowPayload(siteUrl, urlList) {
  const origin = String(siteUrl ?? '').replace(/\/$/, '');
  const host = new URL(origin).host;
  const keyLocation = `${origin}/${INDEXNOW_KEY}.txt`;
  return { host, key: INDEXNOW_KEY, keyLocation, urlList };
}

export async function submitIndexNow(siteUrl, { retry = false, dryRun = false } = {}) {
  const origin = String(siteUrl ?? '').replace(/\/$/, '');
  const host = new URL(origin).host;
  const keyLocation = `${origin}/${INDEXNOW_KEY}.txt`;

  const keyRes = await fetch(keyLocation);
  const keyBody = (await keyRes.text()).trim();
  if (!keyRes.ok || keyBody !== INDEXNOW_KEY) {
    const reason = `key file ${keyLocation} returned ${keyRes.status}, body ${JSON.stringify(keyBody.slice(0, 80))}`;
    if (retry) {
      console.warn(`[indexnow] ${reason}; retrying once in 15s`);
      await sleep(15000);
      return submitIndexNow(origin, { retry: false });
    }
    return { ok: false, reason, status: keyRes.status, count: 0 };
  }

  const sitemapRes = await fetch(`${origin}/sitemap.xml`);
  const xml = await sitemapRes.text();
  if (!sitemapRes.ok) {
    return { ok: false, reason: `sitemap ${sitemapRes.status}`, status: sitemapRes.status, count: 0 };
  }
  const urlList = urlsFromSitemap(xml);
  if (urlList.length === 0) {
    return { ok: false, reason: 'sitemap had no <loc>', status: sitemapRes.status, count: 0 };
  }

  const payload = indexNowPayload(origin, urlList);
  if (dryRun) {
    return { ok: true, dryRun: true, status: 0, count: urlList.length, keyLocation: payload.keyLocation, urlList };
  }

  const post = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const detail = (await post.text()).slice(0, 300);
  // 200 and 202 are the documented success codes. Anything else is a real failure.
  const ok = post.status === 200 || post.status === 202;
  return { ok, status: post.status, count: urlList.length, detail, keyLocation };
}

const isCli = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const siteUrl = process.env.SITE_URL || 'https://otrace.co';
  const dryRun = process.argv.includes('--dry-run');
  const run = dryRun
    ? import('./theme/discovery.js').then(({ sitemapXml }) => {
      const urlList = urlsFromSitemap(sitemapXml(siteUrl));
      const payload = indexNowPayload(siteUrl, urlList);
      return {
        ok: true,
        dryRun: true,
        status: 0,
        count: urlList.length,
        keyLocation: payload.keyLocation,
        markdown: urlList.filter((url) => url.endsWith('.md')).length,
      };
    })
    : submitIndexNow(siteUrl, { retry: true });
  run
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('[indexnow]', err);
      process.exit(1);
    });
}

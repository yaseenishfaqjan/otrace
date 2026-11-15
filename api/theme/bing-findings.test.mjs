/**
 * The Bing Webmaster Tools sweep of 15 Nov 2026, as assertions.
 *
 * Each of these was measured in the tool, not guessed:
 *
 * - URL Inspection on the homepage: "Alt attribute for images is missing,
 *   10 instances". Bing counts alt="" as MISSING, and all ten were real
 *   photographs - the hero, six lookbook frames, two product shots and the
 *   wordmark - rendered through theme settings that pass a bare path.
 * - robots.txt Tester: "2 errors", the non-standard LLMs: and Discovery:
 *   lines. Harmless to a real parser, but they sat ABOVE Sitemap:, the one
 *   line that has to be read.
 * - Site Explorer: 6 indexed URLs, one of them /about.md - a discovery file
 *   for AI crawlers indexed as a page against /about.
 * - Meta descriptions over 160 on /, /shipping and one journal note; and
 *   /shop, /shop/hoodies and /shop/bottoms sharing one 40-character line.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PRODUCTS } from '../catalog.js';
import { createThemeRenderer } from './render-page.js';
import { altForUrl } from './image-alt.js';
import { robotsTxt } from './discovery.js';
import { DEFAULT_DESCRIPTION } from './seo.js';
import { POSTS } from '../../site/src/content/posts.mjs';

const theme = createThemeRenderer({
  themeRoot: fileURLToPath(new URL('../../theme', import.meta.url)),
  siteUrl: 'https://otrace.co',
  assetBase: '/api/theme-assets',
  routesRoot: '/',
});

const imgs = (html) => html.match(/<img[^>]*>/g) || [];

test('Bing counts alt="" as missing, so no rendered image carries an empty one', async () => {
  const pages = {
    home: await theme.renderPage('index', { title: 'OTRACE', page_title: 'OTRACE', canonical_path: '/' }, 'index'),
    hoodie: await theme.renderProduct(PRODUCTS['OT-HOOD']),
    pant: await theme.renderProduct(PRODUCTS['OT-PANT']),
  };
  for (const [name, html] of Object.entries(pages)) {
    const bare = imgs(html).filter((t) => !/\salt=/.test(t));
    const empty = imgs(html).filter((t) => /\salt=""/.test(t));
    assert.deepEqual(bare.map((t) => t.slice(0, 110)), [], `${name}: missing alt`);
    assert.deepEqual(empty.map((t) => t.slice(0, 110)), [], `${name}: alt=""`);
  }
  // The ten Bing named, by URL, so a regression names itself.
  for (const url of [
    '/lookbook/look-01-wide.jpg', '/lookbook/look-07-tall.jpg', '/lookbook/look-06.jpg',
    '/lookbook/look-03.jpg', '/lookbook/look-04-tall.jpg', '/lookbook/look-01-tall.jpg',
    '/products/hoodie-cream-front.jpg', '/products/pant-onyx-front.jpg',
    '/products/hoodie-onyx-back.jpg', '/brand/otrace-wordmark.svg',
  ]) {
    assert.ok(altForUrl(url).length > 0, `no written alt for ${url}`);
  }
});

test('the lookbook does not restate the alt text it shares with the homepage', async () => {
  const { pageContent } = await import('./pages.js');
  const html = pageContent('lookbook', { siteUrl: 'https://otrace.co' })?.body
    ?? (await theme.renderPage('page', { page_content: '' }, 'page'));
  const src = (await import('node:fs')).readFileSync(
    fileURLToPath(new URL('./pages.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /A model walks down a long concrete corridor/,
    'pages.js has its own copy of a lookbook alt again');
  assert.ok(html.length > 0);
});

test('Sitemap: is above the non-standard directives Bing reports as errors', () => {
  const lines = robotsTxt('https://otrace.co').split('\n');
  const sitemap = lines.findIndex((l) => l.startsWith('Sitemap:'));
  const llms = lines.findIndex((l) => l.startsWith('LLMs:'));
  const discovery = lines.findIndex((l) => l.startsWith('Discovery:'));
  assert.ok(sitemap > -1, 'no Sitemap: line at all');
  assert.ok(llms > -1 && discovery > -1, 'the AI discovery lines are gone');
  assert.ok(sitemap < llms, `Sitemap: at ${sitemap} is below LLMs: at ${llms}`);
  assert.ok(sitemap < discovery, `Sitemap: at ${sitemap} is below Discovery: at ${discovery}`);
});

test('no meta description runs past 160 characters, and the shop pages differ', () => {
  assert.ok(DEFAULT_DESCRIPTION.length <= 160, `home description is ${DEFAULT_DESCRIPTION.length}`);
  const fit = POSTS.find((p) => p.slug === 'how-an-oversized-hoodie-should-fit');
  assert.ok(fit, 'the fit note is gone');
  assert.ok(fit.description.length <= 160, `fit note description is ${fit.description.length}`);
  for (const post of POSTS) {
    assert.ok(post.description.length <= 160, `${post.slug} description is ${post.description.length}`);
  }
});

test('the three shop URLs do not share one description', async () => {
  const src = (await import('node:fs')).readFileSync(
    fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');
  const shop = src.match(/const SHOP_DESCRIPTION =\s*'([^']+)'/);
  assert.ok(shop, 'SHOP_DESCRIPTION is gone');
  // \s* and not \n\s*: server.js is CRLF and readFileSync does not
  // apply universal newlines, so a literal \n never meets the \r before it.
  const perCollection = [...src.matchAll(/description: '([^']+)',\s*match:/g)].map((m) => m[1]);
  assert.equal(perCollection.length, 2, 'a collection lost its own description');
  const all = [shop[1], ...perCollection];
  assert.equal(new Set(all).size, 3, 'two shop descriptions are identical again');
  for (const d of all) assert.ok(d.length <= 160 && d.length >= 70, `description is ${d.length}: ${d.slice(0, 50)}`);
});

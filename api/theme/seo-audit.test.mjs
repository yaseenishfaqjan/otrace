/**
 * Regressions from the 2026-10-28 live audit.
 * A checker that cannot fail is not a check: the dirty fixture must be rejected
 * before the rendered pages are accepted.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { PRODUCTS } from '../catalog.js';
import { indexNowPayload, urlsFromSitemap } from '../indexnow.js';
import { publicBody, sitemapXml, SITEMAP_REVISION, securityTxt, humansTxt } from './discovery.js';
import { pageContent, questionFaqs, standalonePage } from './pages.js';
import { POSTS } from '../../site/src/content/posts.mjs';

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

const EMPTY_PAGE_SUFFIX = /(?:&ndash;|–|—)\s*Page(?!\s*\d)/;

/** Problems a storefront HTML document still has. Empty means the audit passed. */
export function seoProblems(html) {
  const problems = [];
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  if (EMPTY_PAGE_SUFFIX.test(title)) problems.push(`empty page suffix in title: ${title.trim()}`);

  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const counts = {};
  for (const match of scripts) {
    const raw = match[1];
    if (raw.includes('[object Object]')) problems.push('JSON-LD body is [object Object]');
    let node;
    try {
      node = JSON.parse(raw);
    } catch (err) {
      problems.push(`JSON-LD did not parse: ${err.message}`);
      continue;
    }
    for (const type of [].concat(node['@type'] || [])) {
      counts[type] = (counts[type] || 0) + 1;
    }
    if (JSON.stringify(node).includes('aggregateRating')) problems.push('invented aggregateRating');
  }
  for (const type of ['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage', 'WebPage']) {
    if ((counts[type] || 0) > 1) problems.push(`duplicate ${type} (${counts[type]})`);
  }
  return problems;
}

function assertClean(html, label) {
  const problems = seoProblems(html);
  assert.deepEqual(problems, [], label);
}

function h1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

function meta(html, attr, key) {
  const re = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, 'i');
  const tag = html.match(re)?.[0] || '';
  return tag.match(/content="([^"]*)"/)?.[1] ?? '';
}

function ldNodes(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

test('the audit checker rejects the live defects', () => {
  const dirty = [
    '<title>OTRACE — Heavyweight Hoodies &ndash; Page</title>',
    '<script type="application/ld+json">[object Object]</script>',
    '<script type="application/ld+json">{"@type":"Organization"}</script>',
    '<script type="application/ld+json">{"@type":"Organization"}</script>',
    '<script type="application/ld+json">{"@type":"WebSite"}</script>',
    '<script type="application/ld+json">{"@type":"WebSite"}</script>',
    '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>',
    '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>',
  ].join('\n');
  const problems = seoProblems(dirty);
  assert.ok(problems.some((line) => /empty page suffix/.test(line)));
  assert.ok(problems.some((line) => /\[object Object\]/.test(line)));
  assert.ok(problems.some((line) => /duplicate Organization/.test(line)));
  assert.ok(problems.some((line) => /duplicate WebSite/.test(line)));
  assert.ok(problems.some((line) => /duplicate BreadcrumbList/.test(line)));
  assert.ok(problems.some((line) => /did not parse/.test(line)));
});

test('titles drop the empty Page suffix, and a real page number can still print', async () => {
  const theme = await renderer();
  const home = await theme.renderPage('index', {
    title: 'OTRACE',
    page_title: 'OTRACE — Heavyweight Oversized Hoodies & Wide-Leg Sweatpants',
    canonical_path: '/',
  }, 'index');
  assertClean(home, 'home');
  assert.match(home, /<title>[\s\S]*Heavyweight Oversized Hoodies/);
  assert.doesNotMatch(home, EMPTY_PAGE_SUFFIX);
  assert.match(home, /<meta name="theme-color" content="#000000">/);
  assert.match(home, /rel="manifest" href="https:\/\/otrace\.co\/site\.webmanifest"/);
  assert.equal(meta(home, 'property', 'og:image'), 'https://otrace.co/og.jpg');
  assert.equal(meta(home, 'name', 'twitter:image'), 'https://otrace.co/og.jpg');
  const homeTypes = ldNodes(home).map((node) => node['@type']);
  assert.equal(homeTypes.filter((type) => type === 'Organization').length, 1);
  assert.equal(homeTypes.filter((type) => type === 'WebSite').length, 1);
  assert.equal(homeTypes.filter((type) => type === 'BreadcrumbList').length, 1);
  assert.ok(homeTypes.includes('WebPage'));

  const unset = await theme.renderPage('index', {
    title: 'OTRACE',
    page_title: 'OTRACE — Heavyweight Oversized Hoodies & Wide-Leg Sweatpants',
    canonical_path: '/',
    current_page: null,
  }, 'index');
  assert.doesNotMatch(unset, EMPTY_PAGE_SUFFIX);

  const paged = await theme.renderPage('collection', {
    title: 'Shop',
    page_title: 'Shop Heavyweight Hoodies & Sweatpants — OTRACE',
    canonical_path: '/shop',
    current_page: 2,
    collection: { products: [], title: 'Shop', handle: 'all' },
  }, 'collection');
  assert.match(paged, /&ndash;\s*Page\s+2/);
});

test('hoodie and pant pages have one product h1, a product image, and parseable schema', async () => {
  const theme = await renderer();
  const cases = [
    ['OT-HOOD', 'Oversized Hoodie', '/products/hoodie-onyx-worn-front.jpg', 'Warm Cream', '/products/hoodie-cream-worn-front.jpg'],
    ['OT-PANT', 'Wide-Leg Sweatpant', '/products/pant-onyx-worn.jpg', 'Warm Cream', '/products/pant-cream-worn.jpg'],
  ];
  for (const [sku, name, image, color, colorImage] of cases) {
    const html = await theme.renderProduct(PRODUCTS[sku]);
    assertClean(html, sku);
    const headings = h1s(html);
    assert.deepEqual(headings, [name], `${sku} h1s ${JSON.stringify(headings)}`);
    assert.equal(meta(html, 'property', 'og:image'), `https://otrace.co${image}`);
    assert.equal(meta(html, 'name', 'twitter:image'), `https://otrace.co${image}`);
    assert.doesNotMatch(html, /aggregateRating/);
    assert.doesNotMatch(html, /PreOrder/);
    assert.match(html, /InStock/);
    const nodes = ldNodes(html);
    const product = nodes.find((node) => node['@type'] === 'ProductGroup');
    assert.equal(product.name, name);
    assert.equal(product.offers ? 'has offers' : 'group', 'group');
    assert.equal(product.hasVariant[0].offers.price, '80.00');
    assert.equal(nodes.filter((node) => node['@type'] === 'Organization').length, 1);
    assert.equal(nodes.filter((node) => node['@type'] === 'BreadcrumbList').length, 1);
    assert.equal(nodes.filter((node) => node['@type'] === 'FAQPage').length, 1);
    const speakable = nodes.find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(speakable.speakable.cssSelector, ['.otrace-fact']);

    const coloured = await theme.renderProduct(PRODUCTS[sku], { color });
    assert.equal(meta(coloured, 'property', 'og:image'), `https://otrace.co${colorImage}`);
  }
});

test('the shop listing has no empty Page suffix and one breadcrumb list', async () => {
  const theme = await renderer();
  const html = await theme.renderCollection({
    handle: 'all',
    title: 'AW2026',
    description: 'Heavyweight hoodies and wide-leg sweatpants.',
    products: Object.values(PRODUCTS),
  });
  assertClean(html, 'shop');
  assert.match(html, /Shop Heavyweight Hoodies/);
  assert.doesNotMatch(html, EMPTY_PAGE_SUFFIX);
  assert.equal(ldNodes(html).filter((node) => node['@type'] === 'BreadcrumbList').length, 1);
  assert.equal(ldNodes(html).filter((node) => node['@type'] === 'Organization').length, 1);
});

test('complete-set is one product URL, and the short path redirects', async () => {
  const theme = await renderer();
  const page = standalonePage('complete-set');
  const { setLd, breadcrumbLd } = await import('./seo.js');
  const html = await theme.renderPage('page', {
    ...page,
    json_ld: [
      setLd(SITE),
      breadcrumbLd(SITE, [
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        { name: 'Complete set', path: '/product/complete-set' },
      ]),
    ],
  }, 'page');
  assertClean(html, 'complete-set');
  assert.match(html, /<title>[\s\S]*Complete set — OTRACE/);
  assert.doesNotMatch(html, EMPTY_PAGE_SUFFIX);
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(canonicals, ['https://otrace.co/product/complete-set']);
  assert.equal(meta(html, 'property', 'og:image'), 'https://otrace.co/products/hoodie-onyx-worn-front.jpg');
  const product = ldNodes(html).find((node) => node['@type'] === 'Product');
  assert.equal(product.name, 'Complete set');
  assert.equal(product.offers.price, '140.00');
  assert.match(html, /\$140\.00/);
  assert.match(html, /\$200\.00/);
  assert.match(html, /\$80\.00/);
  assert.doesNotMatch(html, /aggregateRating/);
  assert.ok(h1s(html).some((text) => text.includes('Complete set')));

  const { mountStorefront } = await import('./mount-storefront.js');
  const app = express();
  mountStorefront(app, {
    themeRenderer: theme,
    siteUrl: SITE,
    sendThemeHtml: (res, body) => res.type('html').send(body),
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/complete-set', '/complete-set/']) {
      const res = await fetch(base + route, { redirect: 'manual' });
      assert.equal(res.status, 301, route);
      assert.equal(res.headers.get('location'), '/product/complete-set');
    }
    const md = await fetch(base + '/complete-set.md', { redirect: 'manual' });
    assert.equal(md.status, 301);
    assert.equal(md.headers.get('location'), '/product/complete-set.md');
    const pageRes = await fetch(base + '/product/complete-set');
    assert.equal(pageRes.status, 200);
    const body = await pageRes.text();
    assert.match(body, /rel="canonical" href="https:\/\/otrace\.co\/product\/complete-set"/);
    assert.doesNotMatch(body, /rel="canonical" href="https:\/\/otrace\.co\/"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('sizing and garment-dyed answer the question before the rest of the section', async () => {
  const theme = await renderer();
  const sizing = pageContent('sizing');
  const sizingHtml = await theme.renderPage('page', sizing, 'page');
  assertClean(sizingHtml, 'sizing');
  const sizingFaq = ldNodes(sizingHtml).find((node) => node['@type'] === 'FAQPage');
  assert.ok(sizingFaq.mainEntity.length >= 4);
  for (const entity of sizingFaq.mainEntity) {
    const answer = entity.acceptedAnswer.text;
    assert.ok(words(answer).length <= 50, entity.name);
    const visible = new RegExp(`<h2>${entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2><p>([\\s\\S]*?)</p>`);
    const paragraph = sizingHtml.match(visible)?.[1];
    assert.equal(paragraph, answer, entity.name);
  }
  assert.match(sizingHtml, /href="\/product\/oversized-hoodie"/);
  assert.match(sizingHtml, /href="\/product\/complete-set"/);
  assert.match(sizingHtml, /href="\/garment-dyed"/);

  const dyed = pageContent('garment-dyed');
  const dyedHtml = await theme.renderPage('page', dyed, 'page');
  assertClean(dyedHtml, 'garment-dyed');
  const dyedFaq = ldNodes(dyedHtml).find((node) => node['@type'] === 'FAQPage');
  const meaning = dyedFaq.mainEntity.find((entity) => entity.name === 'What does garment dyed mean?');
  assert.match(dyedHtml, new RegExp(`class="hdt-dye-lead otrace-fact">${meaning.acceptedAnswer.text}`));
  assert.ok(words(meaning.acceptedAnswer.text).length <= 50);
  for (const entity of dyedFaq.mainEntity.filter((item) => item !== meaning)) {
    const visible = new RegExp(`<h2>${entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2><p>([\\s\\S]*?)</p>`);
    assert.equal(dyedHtml.match(visible)?.[1], entity.acceptedAnswer.text, entity.name);
  }
});

test('journal notes lead with the question and a short answer', async () => {
  const theme = await renderer();
  const { journalPostHtml } = await import('./journal.js');
  const { blogPostLd, faqLd, breadcrumbLd, speakableLd } = await import('./seo.js');
  for (const post of POSTS) {
    const faqs = questionFaqs(post.sections);
    assert.ok(faqs.length >= 1, post.slug);
    assert.ok(words(faqs[0].answer).length <= 50, post.slug);
    const html = await theme.renderPage('page', {
      title: post.h1,
      page_title: `${post.h1} — OTRACE`,
      page_description: post.description,
      content: journalPostHtml(post),
      handle: post.slug,
      canonical_path: `/blog/${post.slug}`,
      json_ld: [
        blogPostLd(post, SITE),
        faqLd(faqs),
        breadcrumbLd(SITE, [
          { name: 'Home', path: '/' },
          { name: 'Journal', path: '/blog' },
          { name: post.h1, path: `/blog/${post.slug}` },
        ]),
        speakableLd(SITE, `/blog/${post.slug}`),
      ],
    }, 'article');
    assertClean(html, post.slug);
    assert.match(html, new RegExp(`<h2>${faqs[0].question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2>`));
    assert.match(html, /class="hdt-journal-answer otrace-fact"/);
    const faq = ldNodes(html).find((node) => node['@type'] === 'FAQPage');
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, faqs[0].answer);
    assert.equal(ldNodes(html).filter((node) => node['@type'] === 'WebPage').length, 1);
  }
});

test('discovery files list the complete set, keep markdown out of the sitemap, and publish security.txt', () => {
  const md = publicBody('/product/complete-set.md', SITE);
  assert.equal(md?.type, 'text/markdown; charset=utf-8');
  const text = String(md.body);
  assert.match(text, /^# Complete set/m);
  assert.match(text, /140 USD/);
  assert.match(text, /80 USD/);
  assert.doesNotMatch(text, /148/);
  assert.match(text, /What is in the complete set\?/);

  const llms = String(publicBody('/llms.txt', SITE).body);
  assert.match(llms, /Last updated: 2026-10-28/);
  assert.match(llms, /https:\/\/otrace\.co\/product\/complete-set\.md/);
  assert.match(llms, /not in the Google sitemap/);

  const sitemap = sitemapXml(SITE);
  assert.equal(sitemap.match(/\/product\/complete-set</g).length, 1);
  assert.doesNotMatch(sitemap, /\.md</);
  assert.match(sitemap, /<lastmod>2026-10-28<\/lastmod>/);
  assert.equal(SITEMAP_REVISION, '2026-10-28');
  const blogLastmod = sitemap.match(/what-is-a-450-gsm-hoodie<\/loc>\s*<lastmod>([^<]+)/);
  assert.equal(blogLastmod?.[1], '2026-10-26');

  const security = publicBody('/.well-known/security.txt', SITE);
  assert.match(String(security.body), /Contact: mailto:info@otrace\.co/);
  assert.equal(String(security.body), securityTxt(SITE));
  const humans = publicBody('/humans.txt', SITE);
  assert.match(String(humans.body), /Contact: info@otrace\.co/);
  assert.equal(String(humans.body), humansTxt(SITE));
  assert.doesNotMatch(String(humans.body), /https?:\/\/(instagram|facebook|tiktok|x)\.com/i);

  const manifest = JSON.parse(String(publicBody('/site.webmanifest', SITE).body));
  assert.equal(manifest.theme_color, '#000000');
  assert.equal(manifest.background_color, '#000000');
  assert.equal(manifest.name, 'OTRACE');

  const bing = publicBody('/BingSiteAuth.xml', SITE);
  assert.equal(bing?.type, 'application/xml; charset=utf-8');
  assert.equal(
    String(bing.body),
    '<?xml version="1.0"?>\n<users>\n\t<user>B84578EA798497426806EE05427AAD83</user>\n</users>',
  );
  assert.doesNotMatch(sitemap, /BingSiteAuth/);

  const urls = urlsFromSitemap(sitemap);
  const payload = indexNowPayload(SITE, urls);
  assert.equal(payload.keyLocation, `https://otrace.co/32dfcb834125ce46de389d323db4c3b0.txt`);
  assert.equal(urls.filter((url) => url.endsWith('.md')).length, 0);
  assert.ok(urls.includes('https://otrace.co/product/complete-set'));

  const nginx = fs.readFileSync(path.join(repoRoot, 'deploy/nginx-theme-routes.conf'), 'utf8');
  assert.match(nginx, /location ~ \^\/complete-set\/\?\$ \{ return 301 \/product\/complete-set; \}/);
  assert.match(nginx, /location = \/BingSiteAuth\.xml \{/);
  const hook = fs.readFileSync(path.join(repoRoot, 'deploy/after-deploy.sh'), 'utf8');
  assert.match(hook, /node api\/indexnow\.js/);
  const key = publicBody('/32dfcb834125ce46de389d323db4c3b0.txt', SITE);
  assert.equal(String(key.body).trim(), '32dfcb834125ce46de389d323db4c3b0');
});

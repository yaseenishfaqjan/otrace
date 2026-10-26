/**
 * Checks that can fail.
 *
 *   node seo/verify.mjs --self-test
 *     Proves the PreOrder detector rejects a page that contains it, and accepts
 *     one that does not. Exits 1 if the detector is blind.
 *
 *   node seo/verify.mjs --root site/dist/public
 *     Checks a prerendered build: availability copy, img width/height, JSON-LD,
 *     llms.txt, robots.txt, image dimensions vs files, FAQ text vs llms.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Text is read with line endings normalised.
 *
 * Several checks here compare a built file against its source, or match a
 * regex that requires a bare LF. git runs core.autocrlf=true and the repo
 * stores LF, so on Windows the working tree is CRLF and the built output is
 * LF - and every one of those checks failed on content that was byte-correct.
 * A verifier that always fails is not a verifier.
 */
const readText = (file) =>
  fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function pageProblems(html, label) {
  const problems = [];
  const preorder = (html.match(/PreOrder/g) || []).length;
  const words = (html.match(/pre-order/gi) || []).length;
  if (preorder !== 0) problems.push(`${label}: PreOrder count ${preorder}, want 0`);
  if (words !== 0) problems.push(`${label}: pre-order count ${words}, want 0`);
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const bare = imgs.filter((tag) => !/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag));
  if (bare.length) problems.push(`${label}: ${bare.length} of ${imgs.length} img tags lack width and height`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((m) => m[1]);
  if (label.includes('product') || label.endsWith('/sizing') || label.includes('garment') || label.endsWith('/shipping') || label.includes('/blog')) {
    if (blocks.length === 0) problems.push(`${label}: no JSON-LD`);
  }
  for (const [i, block] of blocks.entries()) {
    let data;
    try {
      data = JSON.parse(block);
    } catch (err) {
      problems.push(`${label}: JSON-LD block ${i} does not parse (${err.message})`);
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (node['@type'] !== 'FAQPage') continue;
      for (const q of node.mainEntity ?? []) {
        const text = q.acceptedAnswer?.text ?? '';
        if (!html.includes(q.name)) problems.push(`${label}: FAQ question not visible: ${q.name}`);
        if (!html.includes(text)) problems.push(`${label}: FAQ answer not visible: ${text.slice(0, 48)}`);
      }
    }
    if (JSON.stringify(data).includes('aggregateRating') || JSON.stringify(data).includes('"review"')) {
      problems.push(`${label}: review markup is present`);
    }
  }
  if (/noarchive|nocache/i.test(html)) problems.push(`${label}: robots meta carries NOARCHIVE or NOCACHE`);
  return problems;
}

function selfTest() {
  const dirty = pageProblems('<html><script type="application/ld+json">{"availability":"https://schema.org/PreOrder"}</script><img src="/a.jpg"></html>', 'fixture');
  const clean = pageProblems('<html><script type="application/ld+json">{"availability":"https://schema.org/InStock"}</script><img src="/a.jpg" width="819" height="1024"></html>', 'clean');
  const blind = !dirty.some((p) => p.includes('PreOrder')) || !dirty.some((p) => p.includes('img'));
  const falsePositive = clean.length !== 0;
  if (blind || falsePositive) {
    console.error('SELF-TEST FAILED', { dirty, clean });
    process.exit(1);
  }
  console.log('self-test: dirty fixture failed on purpose');
  for (const line of dirty) console.log('  fail:', line);
  console.log('self-test: clean fixture produced 0 problems');
}

function jpegSize(file) {
  const data = fs.readFileSync(file);
  if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error(`${file} is not a JPEG`);
  let i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 0xff) { i += 1; continue; }
    const marker = data[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const seglen = data.readUInt16BE(i + 2);
    i += 2 + seglen;
  }
  throw new Error(`no SOF in ${file}`);
}

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function checkRoot(dir) {
  const problems = [];
  const files = walkHtml(dir);
  if (files.length < 5) problems.push(`only ${files.length} html files under ${dir}`);
  for (const file of files) {
    const html = readText(file);
    const label = file.slice(dir.length) || '/';
    if (label.includes('404')) continue;
    problems.push(...pageProblems(html, label));
  }
  const index = readText(path.join(dir, 'index.html'));
  if (!/InStock/.test(index) && !/in stock/i.test(index)) problems.push('home does not say in stock');
  if (!index.includes('rel="describedby"') || !index.includes('/llms.txt')) problems.push('home is missing the llms.txt describedby link');
  if (!index.includes('type="text/markdown"') || !index.includes('/index.md')) problems.push('home is missing the markdown alternate');
  if (!index.includes('info@otrace.co')) problems.push('home Organization JSON-LD is missing info@otrace.co');
  if (!index.includes('OTRACE sells a 450 GSM garment-dyed Oversized Hoodie')) problems.push('home Organization description drifted');
  if (!index.includes('"@type":"WebSite"') && !index.includes('"@type": "WebSite"')) problems.push('home is missing WebSite JSON-LD');
  const hoodie = files.find((f) => f.endsWith(`${path.sep}product${path.sep}oversized-hoodie.html`) || f.endsWith('product/oversized-hoodie.html'));
  if (!hoodie) problems.push('missing prerendered hoodie page');
  else {
    const html = readText(hoodie);
    const stock = (html.match(/InStock/g) || []).length;
    if (stock < 1) problems.push(`hoodie InStock count ${stock}, want >0`);
    if (!html.includes('Do heavyweight hoodies shrink?')) problems.push('hoodie FAQ heading missing');
  }
  const llmsPath = path.join(dir, 'llms.txt');
  if (!fs.existsSync(llmsPath)) problems.push('llms.txt missing from build');
  else {
    const llms = readText(llmsPath);
    const source = readText(path.join(root, 'seo', 'llms.txt'));
    if (llms !== source) problems.push('dist llms.txt differs from seo/llms.txt');
    if (llms.split('\n').length > 120) problems.push(`llms.txt is ${llms.split('\n').length} lines, want an index under 120`);
    if (Buffer.byteLength(llms) > 10240) problems.push('llms.txt is over 10 KB');
    for (const needle of ['> OTRACE sells', '## What We Do Not Do', '## Contact', '## AI Discovery Files', 'info@otrace.co']) {
      if (!llms.includes(needle)) problems.push(`llms.txt missing ${needle}`);
    }
    const entity = readText(path.join(root, 'site', 'src', 'lib', 'entity.ts'));
    const summary = entity.match(/ENTITY_SUMMARY =\n\s*'([^']+)'/)?.[1];
    if (!summary || !llms.includes(`> ${summary}`)) problems.push('llms.txt blockquote does not match ENTITY_SUMMARY');
    const identityPath = path.join(dir, 'identity.json');
    if (!fs.existsSync(identityPath)) problems.push('identity.json missing from build');
    else {
      const identity = JSON.parse(readText(identityPath));
      if (identity.description !== summary) problems.push('identity.json description does not match ENTITY_SUMMARY');
      if (identity.email !== 'info@otrace.co' || identity.name !== 'OTRACE') problems.push('identity.json name or email drifted');
      if (!Array.isArray(identity.sameAs) || identity.sameAs.length !== 0) problems.push('identity.json sameAs must stay empty until a real profile exists');
      const banned = JSON.stringify(identity).toLowerCase();
      for (const host of ['wikipedia.org', 'wikidata.org', 'instagram.com', 'tiktok.com']) {
        if (banned.includes(host)) problems.push(`identity.json invents ${host}`);
      }
    }
    const faqs = readText(path.join(root, 'site', 'src', 'lib', 'faqs.ts'));
    const full = readText(path.join(dir, 'llms-full.txt'));
    const faqAi = readText(path.join(dir, 'faq-ai.txt'));
    if (full !== readText(path.join(root, 'seo', 'llms-full.txt'))) problems.push('dist llms-full.txt differs from seo/llms-full.txt');
    if (faqAi !== readText(path.join(root, 'seo', 'faq-ai.txt'))) problems.push('dist faq-ai.txt differs from seo/faq-ai.txt');
    for (const answer of faqs.matchAll(/answer:\s*\n?\s*'([^']+)'/g)) {
      if (!full.includes(answer[1])) problems.push(`llms-full.txt missing FAQ answer: ${answer[1].slice(0, 60)}`);
      if (!faqAi.includes(answer[1])) problems.push(`faq-ai.txt missing FAQ answer: ${answer[1].slice(0, 60)}`);
    }
    const chart = readText(path.join(root, 'site', 'src', 'lib', 'products.ts'));
    if (/450gsm/.test(chart) || /400–450/.test(chart)) problems.push('products.ts still has a non-canonical GSM string');
    const block = chart.slice(chart.indexOf('export const SIZE_CHART'));
    for (const num of block.matchAll(/\b(\d{2,3})\b/g)) {
      if (!full.includes(`${num[1]} cm`)) problems.push(`llms-full.txt missing measurement ${num[1]} cm`);
    }
    const mirrors = [
      'index.md',
      'about.md',
      'sizing.md',
      'garment-dyed.md',
      'shipping.md',
      'product/oversized-hoodie.md',
      'product/wide-leg-sweatpant.md',
      'llms/pages/index.md',
      'llms/pages/what-is-a-450-gsm-hoodie.md',
      'llms/pages/garment-dyed-vs-piece-dyed.md',
      'llms/pages/how-an-oversized-hoodie-should-fit.md',
      'llms-full.txt',
      'identity.json',
      'ai.txt',
      'faq-ai.txt',
    ];
    for (const rel of mirrors) {
      if (!fs.existsSync(path.join(dir, rel))) problems.push(`missing public discovery file ${rel}`);
      const urlPath = `/${rel}`;
      if (!llms.includes(urlPath) && !llms.includes(`https://otrace.co${urlPath}`)) {
        problems.push(`llms.txt does not link ${urlPath}`);
      }
    }
    for (const rel of [
      'blog/index.md',
      'blog/what-is-a-450-gsm-hoodie.md',
      'blog/garment-dyed-vs-piece-dyed.md',
      'blog/how-an-oversized-hoodie-should-fit.md',
    ]) {
      if (!fs.existsSync(path.join(dir, rel))) problems.push(`missing blog mirror ${rel}`);
    }
    const gsmPost = path.join(dir, 'blog', 'what-is-a-450-gsm-hoodie.html');
    if (!fs.existsSync(gsmPost)) problems.push('blog post was not prerendered');
    else {
      const html = readText(gsmPost);
      if (!html.includes('450 GSM hoodie meaning')) problems.push('blog H1 missing');
      if (!html.includes('BlogPosting')) problems.push('blog post missing BlogPosting');
      if (!html.includes('/blog/what-is-a-450-gsm-hoodie.md')) problems.push('blog post missing markdown alternate');
    }
  }
  const robots = readText(path.join(dir, 'robots.txt'));
  for (const needle of [
    'User-agent: GPTBot',
    'User-agent: OAI-SearchBot',
    'User-agent: ClaudeBot',
    'User-agent: PerplexityBot',
    'User-agent: Google-Extended',
    'User-agent: Applebot-Extended',
    'User-agent: Bingbot',
    'LLMs: https://otrace.co/llms.txt',
    'Discovery: https://otrace.co/identity.json',
    'Disallow: /api/',
  ]) {
    if (!robots.includes(needle)) problems.push(`robots.txt missing ${needle}`);
  }
  const gpt = robots.split(/User-agent: GPTBot\n/)[1]?.split(/\nUser-agent:/)[0] ?? '';
  if (!gpt.includes('Disallow: /api/')) problems.push('GPTBot group does not disallow /api/');
  const key = readText(path.join(root, 'api', 'indexnow.js')).match(/INDEXNOW_KEY = '([0-9a-f]+)'/)[1];
  const keyFile = path.join(dir, `${key}.txt`);
  if (!fs.existsSync(keyFile)) problems.push(`IndexNow key file missing: ${key}.txt`);
  else if (readText(keyFile).trim() !== key) problems.push('IndexNow key file body does not match INDEXNOW_KEY');
  const sitemap = readText(path.join(dir, 'sitemap.xml'));
  const today = new Date().toISOString().slice(0, 10);
  const mods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  if (mods.some((day) => day !== today)) problems.push(`sitemap lastmod ${mods[0]} is not ${today}`);
  if (!sitemap.includes('/garment-dyed')) problems.push('sitemap missing /garment-dyed');

  const sizeTs = readText(path.join(root, 'site', 'src', 'lib', 'image-size.ts'));
  const recorded = [...sizeTs.matchAll(/'([^']+)': \{ width: (\d+), height: (\d+) \}/g)];
  if (recorded.length < 20) problems.push(`image-size map has ${recorded.length} entries`);
  for (const [, rel, w, h] of recorded) {
    const jpg = path.join(root, 'site', 'public', rel);
    const webp = jpg.replace(/\.jpe?g$/, '.webp');
    if (!fs.existsSync(jpg)) problems.push(`missing ${rel}`);
    else {
      const actual = jpegSize(jpg);
      if (actual.width !== Number(w) || actual.height !== Number(h)) {
        problems.push(`${rel} is ${actual.width}x${actual.height}, map says ${w}x${h}`);
      }
    }
    if (!fs.existsSync(webp)) problems.push(`missing webp for ${rel}`);
    else if (fs.statSync(webp).size >= fs.statSync(jpg).size) {
      problems.push(`${rel} webp is not smaller than the jpeg`);
    }
  }
  return problems;
}

const args = process.argv.slice(2);
selfTest();
if (args.includes('--self-test') && !args.includes('--root')) process.exit(0);
const rootFlag = args.indexOf('--root');
if (rootFlag === -1) {
  console.error('pass --root <dist> or --self-test');
  process.exit(1);
}
const problems = checkRoot(path.resolve(args[rootFlag + 1]));
if (problems.length) {
  console.error(`FAIL ${problems.length}`);
  for (const p of problems) console.error(' ', p);
  process.exit(1);
}
console.log('verify: 0 problems');

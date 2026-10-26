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
  if (label.includes('product') || label.endsWith('/sizing') || label.includes('garment') || label.endsWith('/shipping')) {
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
    const html = fs.readFileSync(file, 'utf8');
    const label = file.slice(dir.length) || '/';
    if (label.includes('404')) continue;
    problems.push(...pageProblems(html, label));
  }
  const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  if (!/InStock/.test(index) && !/in stock/i.test(index)) problems.push('home does not say in stock');
  const hoodie = files.find((f) => f.endsWith(`${path.sep}product${path.sep}oversized-hoodie.html`) || f.endsWith('product/oversized-hoodie.html'));
  if (!hoodie) problems.push('missing prerendered hoodie page');
  else {
    const html = fs.readFileSync(hoodie, 'utf8');
    const stock = (html.match(/InStock/g) || []).length;
    if (stock < 1) problems.push(`hoodie InStock count ${stock}, want >0`);
    if (!html.includes('Do heavyweight hoodies shrink?')) problems.push('hoodie FAQ heading missing');
  }
  const llmsPath = path.join(dir, 'llms.txt');
  if (!fs.existsSync(llmsPath)) problems.push('llms.txt missing from build');
  else {
    const llms = fs.readFileSync(llmsPath, 'utf8');
    const source = fs.readFileSync(path.join(root, 'seo', 'llms.txt'), 'utf8');
    if (llms !== source) problems.push('dist llms.txt differs from seo/llms.txt');
    const faqs = fs.readFileSync(path.join(root, 'site', 'src', 'lib', 'faqs.ts'), 'utf8');
    for (const answer of faqs.matchAll(/answer:\s*\n?\s*'([^']+)'/g)) {
      if (!llms.includes(answer[1])) problems.push(`llms.txt missing FAQ answer: ${answer[1].slice(0, 60)}`);
    }
    const chart = fs.readFileSync(path.join(root, 'site', 'src', 'lib', 'products.ts'), 'utf8');
    const block = chart.slice(chart.indexOf('export const SIZE_CHART'));
    for (const num of block.matchAll(/\b(\d{2,3})\b/g)) {
      if (!llms.includes(`${num[1]} cm`)) problems.push(`llms.txt missing measurement ${num[1]} cm`);
    }
  }
  const robots = fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8');
  for (const needle of ['User-agent: GPTBot', 'User-agent: ClaudeBot', 'User-agent: PerplexityBot', 'LLMs: https://otrace.co/llms.txt', 'Disallow: /api/']) {
    if (!robots.includes(needle)) problems.push(`robots.txt missing ${needle}`);
  }
  const gpt = robots.split(/User-agent: GPTBot\n/)[1]?.split(/\nUser-agent:/)[0] ?? '';
  if (!gpt.includes('Disallow: /api/')) problems.push('GPTBot group does not disallow /api/');
  const key = fs.readFileSync(path.join(root, 'api', 'indexnow.js'), 'utf8').match(/INDEXNOW_KEY = '([0-9a-f]+)'/)[1];
  const keyFile = path.join(dir, `${key}.txt`);
  if (!fs.existsSync(keyFile)) problems.push(`IndexNow key file missing: ${key}.txt`);
  else if (fs.readFileSync(keyFile, 'utf8').trim() !== key) problems.push('IndexNow key file body does not match INDEXNOW_KEY');
  const sitemap = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const mods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  if (mods.some((day) => day !== today)) problems.push(`sitemap lastmod ${mods[0]} is not ${today}`);
  if (!sitemap.includes('/garment-dyed')) problems.push('sitemap missing /garment-dyed');

  const sizeTs = fs.readFileSync(path.join(root, 'site', 'src', 'lib', 'image-size.ts'), 'utf8');
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

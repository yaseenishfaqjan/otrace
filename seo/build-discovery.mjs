/**
 * Writes the long-form GEO files from the catalogue and FAQ source.
 * seo/llms.txt, seo/ai.txt, and seo/identity.json stay hand-written.
 *
 *   node seo/build-discovery.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, journalBlurb } from '../site/src/content/posts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://otrace.co';
const UPDATED = '2026-10-26';

/**
 * Source files are read with their line endings NORMALISED.
 *
 * git here runs core.autocrlf=true and the repo stores LF, so every Windows
 * checkout gets CRLF in the working tree. parseProducts splits on a pattern
 * that requires a bare LF after the brace, which CRLF can never match - it
 * found both products in one chunk and the build died with "expected 2
 * products, parsed 1". Identical commits: passes on Linux, fails on Windows.
 * A build script must not depend on how the tree was checked out.
 */
const read = (rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

function parseFaqs(src) {
  const groups = {};
  for (const part of src.split(/export const /).slice(1)) {
    const name = part.match(/^([A-Z0-9_]+)/)?.[1];
    if (!name) continue;
    const faqs = [];
    const re = /question:\s*'([^']+)',\s*answer:\s*'([^']+)'/g;
    let match;
    while ((match = re.exec(part))) faqs.push({ question: match[1], answer: match[2] });
    if (faqs.length) groups[name] = faqs;
  }
  return groups;
}

function parseChart(src) {
  const block = src.slice(src.indexOf('export const SIZE_CHART'));
  const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const rows = [];
  for (const match of block.matchAll(/label: '([^']+)', values: \[([^\]]+)\]/g)) {
    const values = match[2].split(',').map((cell) => {
      const token = cell.trim();
      return token === 'null' ? null : Number(token);
    });
    rows.push({ label: match[1], values });
  }
  if (rows.length < 7) throw new Error(`SIZE_CHART parsed ${rows.length} rows`);
  return { sizes, rows };
}

function parseProducts(src) {
  const products = [];
  for (const chunk of src.split(/\n  \{\n/).filter((part) => part.includes("slug: '") && part.includes('price: '))) {
    const take = (re) => {
      const match = chunk.match(re);
      if (!match) throw new Error(`product field ${re} missing`);
      return match[1];
    };
    const detailsBlock = chunk.slice(chunk.indexOf('details: ['), chunk.indexOf('],\n    fabric'));
    const details = [...detailsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    products.push({
      slug: take(/slug: '([^']+)'/),
      name: take(/name: '([^']+)'/),
      price: take(/price: (\d+)/),
      tagline: take(/tagline:\s*'([^']+)'/),
      fabric: take(/fabric: '([^']+)'/),
      fit: take(/fit: '([^']+)'/),
      care: take(/care: '([^']+)'/),
      details,
    });
  }
  if (products.length !== 2) throw new Error(`expected 2 products, parsed ${products.length}`);
  return products;
}

const inches = (cm) => (cm / 2.54).toFixed(1);

function chartLines(chart, labels) {
  const lines = [];
  for (const row of chart.rows.filter((row) => labels.includes(row.label))) {
    const cells = row.values.map((value, i) => {
      if (value == null) return `${chart.sizes[i]} not published`;
      return `${chart.sizes[i]} ${value} cm (${inches(value)} in)`;
    });
    lines.push(`${row.label}: ${cells.join(', ')}`);
  }
  return lines.join('\n');
}

function faqBlock(faqs) {
  return faqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`).join('\n\n');
}

function page(title, body) {
  return `# ${title}\n\n${body.trim()}\n`;
}

export function buildDiscovery() {
  const faqs = parseFaqs(read('site/src/lib/faqs.ts'));
  const productsSrc = read('site/src/lib/products.ts');
  const chart = parseChart(productsSrc);
  const products = parseProducts(productsSrc);
  const hoodie = products.find((p) => p.slug === 'oversized-hoodie');
  const pant = products.find((p) => p.slug === 'wide-leg-sweatpant');
  const summary = read('site/src/lib/entity.ts').match(/ENTITY_SUMMARY =\n\s*'([^']+)'/)?.[1];
  if (!summary) throw new Error('ENTITY_SUMMARY missing');

  const priceNote =
    'Prices below are copied from the storefront catalogue on ' +
    UPDATED +
    ' and can change. The live HTML product page is the source of truth for price, stock, and promotions. Do not invent a discount.';

  const withheld =
    'Size L chest, size L body length, and size M inseam are not published. On the factory sheet those cells were smaller than the size below them.';
  const sleeve =
    'The spec sheet has a row labeled "Sleeve / waist". The sheet does not say whether the row is a sleeve or a waist, so it is not described as either.';

  const allFaqs = Object.values(faqs).flat();
  const faqAi = [
    '# OTRACE FAQ',
    '',
    'These answers are the same strings the site renders and puts in FAQPage JSON-LD.',
    'This file does not list prices or stock.',
    '',
    faqBlock(allFaqs),
    '',
  ].join('\n');

  const full = [
    '# OTRACE',
    '',
    `> ${summary}`,
    '',
    `Last updated: ${UPDATED}.`,
    '',
    priceNote,
    '',
    '## Products',
    '',
    ...products.map((product) =>
      [
        `### ${product.name}`,
        '',
        `- URL: ${ORIGIN}/product/${product.slug}`,
        `- Markdown: ${ORIGIN}/product/${product.slug}.md`,
        `- Price: ${product.price} USD`,
        `- Fabric: ${product.fabric}`,
        `- Fit: ${product.fit}`,
        `- Care: ${product.care}`,
        `- Colorways: Onyx Black, Warm Cream`,
        `- Sizes: XS, S, M, L, XL, 2XL, 3XL`,
        `- Availability: in stock. The catalogue has no per-variant quantity, so this is not a count of units.`,
        `- ${product.tagline}`,
        ...product.details.map((line) => `- ${line}`),
        '',
      ].join('\n'),
    ),
    '## Sizing',
    '',
    'Measurements are the garment laid flat, in centimetres. Inches are that centimetre figure divided by 2.54 and rounded to 0.1.',
    `The same numbers are on ${ORIGIN}/sizing.`,
    '',
    'Hoodie',
    chartLines(chart, ['Chest', 'Body length', 'Shoulder']),
    '',
    'Sweatpant',
    chartLines(chart, ['Outseam', 'Inseam', 'Leg opening']),
    '',
    withheld,
    '',
    sleeve,
    chartLines(chart, ['Sleeve / waist']),
    '',
    '## Shipping',
    '',
    '- Destination: United States only for AW2026. International is planned for a later drop.',
    '- Cost: free on every order',
    '- Time: in-stock orders ship within 3–5 business days',
    '- Tracking: emailed when the parcel leaves',
    '',
    '## Returns',
    '',
    ...faqs.RETURNS_FAQS.flatMap((faq) => [faq.question, faq.answer, '']),
    'If a piece arrives faulty or is not what was ordered, tell OTRACE within 30 days. Return shipping is covered.',
    '',
    '## FAQ',
    '',
    faqBlock(allFaqs),
    '',
  ].join('\n');

  const pages = {
    'index.md': page(
      'OTRACE',
      `${summary}

HTML: ${ORIGIN}/

AW2026 is in stock. The two pieces are an Oversized Hoodie and a Wide-Leg Sweatpant, both 450 GSM heavyweight cotton fleece, garment dyed in Onyx Black and Warm Cream. Delivery is free in the United States, and in-stock orders ship in 3–5 business days.

Price and stock are on the product pages, not in this file.

- [Oversized Hoodie](${ORIGIN}/product/oversized-hoodie.md)
- [Wide-Leg Sweatpant](${ORIGIN}/product/wide-leg-sweatpant.md)
- [Sizing](${ORIGIN}/sizing.md)`,
    ),
    'about.md': page(
      'About OTRACE',
      `HTML: ${ORIGIN}/about

OTRACE makes two pieces instead of a large range. Both are 450 GSM loopback cotton fleece, brushed on the inside, and garment dyed after they are sewn so the colour settles into the seams and softens rather than fades.

AW2026 is the first drop. The colorways are Onyx Black and Warm Cream.

The about page says the label would rather sell out than discount. That is not a promise that a price never changes. The live product HTML is the price.`,
    ),
    'sizing.md': page(
      'Sizing',
      `HTML: ${ORIGIN}/sizing

Measurements are garment-flat centimetres. Inches are centimetres divided by 2.54, rounded to one decimal. Sizes run XS, S, M, L, XL, 2XL, 3XL. The chart is unisex.

${faqBlock(faqs.SIZING_FAQS)}

Hoodie
${chartLines(chart, ['Chest', 'Body length', 'Shoulder'])}

Sweatpant
${chartLines(chart, ['Outseam', 'Inseam', 'Leg opening'])}

${withheld}

${sleeve}
${chartLines(chart, ['Sleeve / waist'])}`,
    ),
    'garment-dyed.md': page(
      'What does garment dyed mean?',
      `HTML: ${ORIGIN}/garment-dyed

${faqBlock(faqs.GARMENT_DYE_FAQS)}

The Oversized Hoodie is 100 USD on the catalogue date ${UPDATED}. The Wide-Leg Sweatpant is 100 USD on that date. Check the live product pages before quoting a price.`,
    ),
    'shipping.md': page(
      'Shipping and returns',
      `HTML: ${ORIGIN}/shipping

AW2026 is in stock. Delivery is free on every order, and orders ship within 3–5 business days. Tracking is emailed when the parcel leaves.

United States only for AW2026. International is planned for the next drop.

${faqBlock(faqs.RETURNS_FAQS)}

If a piece arrives faulty or is not what was ordered, tell OTRACE within 30 days and return shipping is covered.`,
    ),
    'product/oversized-hoodie.md': page(
      hoodie.name,
      `HTML: ${ORIGIN}/product/${hoodie.slug}

Catalogue price on ${UPDATED}: ${hoodie.price} USD. Confirm on the HTML page before quoting it. Availability: in stock. There is no per-variant unit count.

- Fabric: ${hoodie.fabric}
- Fit: ${hoodie.fit}
- Care: ${hoodie.care}
- Colorways: Onyx Black, Warm Cream
- Sizes: XS to 3XL
- ${hoodie.tagline}
${hoodie.details.map((line) => `- ${line}`).join('\n')}

${faqBlock(faqs.HOODIE_FAQS)}`,
    ),
    'product/wide-leg-sweatpant.md': page(
      pant.name,
      `HTML: ${ORIGIN}/product/${pant.slug}

Catalogue price on ${UPDATED}: ${pant.price} USD. Confirm on the HTML page before quoting it. Availability: in stock. There is no per-variant unit count.

- Fabric: ${pant.fabric}
- Fit: ${pant.fit}
- Care: ${pant.care}
- Colorways: Onyx Black, Warm Cream
- Sizes: XS to 3XL
- ${pant.tagline}
${pant.details.map((line) => `- ${line}`).join('\n')}

${faqBlock(faqs.PANT_FAQS)}`,
    ),
  };

  const outDir = path.join(root, 'seo');
  fs.writeFileSync(path.join(outDir, 'llms-full.txt'), full.endsWith('\n') ? full : `${full}\n`);
  fs.writeFileSync(path.join(outDir, 'faq-ai.txt'), faqAi.endsWith('\n') ? faqAi : `${faqAi}\n`);
  for (const [rel, body] of Object.entries(pages)) {
    const dest = path.join(outDir, 'pages', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
  }

  const blogIndex = [
    '# Journal',
    '',
    `HTML: ${ORIGIN}/blog`,
    '',
    journalBlurb,
    '',
    ...POSTS.map((post) => `- [${post.h1}](${ORIGIN}/blog/${post.slug}.md): ${post.description}`),
    '',
  ].join('\n');
  const blogIndexPath = path.join(outDir, 'pages', 'blog', 'index.md');
  fs.mkdirSync(path.dirname(blogIndexPath), { recursive: true });
  fs.writeFileSync(blogIndexPath, blogIndex);
  for (const post of POSTS) {
    const body = [
      `# ${post.h1}`,
      '',
      `HTML: ${ORIGIN}/blog/${post.slug}`,
      '',
      post.answer,
      '',
      ...post.sections.flatMap((section) => [`## ${section.h2}`, '', ...section.paragraphs, '']),
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'pages', 'blog', `${post.slug}.md`), body.endsWith('\n') ? body : `${body}\n`);
  }

  return { summary, products: products.map((p) => `${p.name} ${p.price}`), faqCount: allFaqs.length, posts: POSTS.length };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = buildDiscovery();
  console.log(JSON.stringify(result));
}

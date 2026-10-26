/**
 * The content pages, built from shared data rather than retyped.
 *
 * Every number here comes from a single source - prices from api/catalog.js,
 * measurements from shared/size-chart.json, FAQ copy from shared/faqs.json -
 * because the page these replaced had hard-coded "148 USD" and "128 USD" in
 * its prose and was still quoting them on the live site long after the prices
 * changed. Prose that restates a number always ends up lying about it.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, formatMoney } from '../catalog.js';

const shared = (name) =>
  JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../shared/${name}`, import.meta.url)), 'utf8'));

const SIZE_CHART = shared('size-chart.json');
const FAQS = shared('faqs.json');

/** Minimal escaping for text dropped into page HTML. */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const faq = (group, question) => {
  const found = (FAQS[group] ?? []).find((f) => f.question === question);
  // A missing FAQ means the copy moved and this page would silently render a
  // gap, so say so rather than publishing a hole.
  if (!found) throw new Error(`missing FAQ in ${group}: ${question}`);
  return found;
};

const faqBlock = (group, question, heading = true) => {
  const f = faq(group, question);
  return `${heading ? `<h2>${esc(f.question)}</h2>` : ''}<p>${esc(f.answer)}</p>`;
};

const price = (sku) => formatMoney(PRODUCTS[sku].priceCents);

/* ---------------------------------------------------------------- sizing */

function sizeTable() {
  const head = SIZE_CHART.sizes.map((s) => `<th scope="col">${esc(s)}</th>`).join('');
  const rows = SIZE_CHART.rows
    .map((row) => {
      // A null is a measurement the factory has not confirmed. It renders as an
      // em dash on purpose: four rows of the spec sheet run backwards at L, and
      // publishing a guess there would drive returns.
      const cells = row.values
        .map((v) => `<td>${v === null ? '&mdash;' : esc(v)}</td>`)
        .join('');
      return `<tr><th scope="row">${esc(row.label)}</th>${cells}</tr>`;
    })
    .join('');
  return `<table class="hdt-size-chart"><thead><tr><th scope="col">Measurement</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

const sizing = () => [
  `<p>Measurements are in centimetres, taken garment-flat. Lay a piece you already`,
  ` own flat and compare rather than measuring your body &mdash; these are the`,
  ` garment's dimensions, not yours.</p>`,
  sizeTable(),
  `<p><strong>Where you see an em dash</strong>, that measurement is not confirmed`,
  ` by the factory yet. Four rows of the AW2026 spec sheet run backwards at L,`,
  ` which would make L smaller than M. We would rather leave the cell blank than`,
  ` publish a number that sends you the wrong size.</p>`,
  `<h2>Fit</h2>`,
  `<p>${esc(PRODUCTS['OT-HOOD'].name)} is cut oversized. Take your usual size for`,
  ` the intended fit, or size down for a cleaner line. ${esc(PRODUCTS['OT-PANT'].name)}`,
  ` is cut wide from the hip and left to break at the ankle.</p>`,
  ...FAQS.SIZING_FAQS.map((f) => `<h2>${esc(f.question)}</h2><p>${esc(f.answer)}</p>`),
].join('');

/* --------------------------------------------------------- garment dyed */

const garmentDyed = () => {
  const hood = PRODUCTS['OT-HOOD'];
  const pant = PRODUCTS['OT-PANT'];
  return [
    faqBlock('GARMENT_DYE_FAQS', 'What does garment dyed mean?', false),
    `<p>The fleece is knit, cut, and sewn, and only then dyed. Seams, rib and body`,
    ` go through the dye together. Two pieces from the same lot match. A later lot`,
    ` can sit a step lighter or darker, which is the process.</p>`,
    `<p>AW2026 uses it on two pieces, both 450 GSM cotton fleece: the `,
    `<a href="/product/${hood.slug}">${esc(hood.name)}</a> at ${price('OT-HOOD')} and the `,
    `<a href="/product/${pant.slug}">${esc(pant.name)}</a> at ${price('OT-PANT')},`,
    ` in Onyx Black and Warm Cream. Together they are the sum of those two prices.`,
    ` Both are in stock and ship within 3&ndash;5 business days inside the United`,
    ` States, with free delivery.</p>`,
    faqBlock('GARMENT_DYE_FAQS', 'Garment dyed vs piece dyed'),
    `<p>Yarn-dyed cloth is coloured before it is knit. Piece-dyed cloth is coloured`,
    ` as fabric, then cut. Garment dyeing is the last of the three, which is why the`,
    ` stitch lines on an OTRACE piece take the colour instead of sitting on top of it.</p>`,
    faqBlock('GARMENT_DYE_FAQS', 'Does garment dye fade?'),
    `<h2>Care</h2>`,
    `<p>Machine wash cold, inside out. Tumble dry low. Do not iron the embroidery on`,
    ` the hoodie. The same care is on each product page.</p>`,
  ].join('');
};

/* ------------------------------------------------------------- lookbook */

const LOOKBOOK = [
  ['/lookbook/look-01-tall.jpg', 'The AW2026 set in Onyx Black'],
  ['/lookbook/look-02.jpg', 'The Oversized Hoodie in Warm Cream'],
  ['/lookbook/look-03.jpg', 'Wide-Leg Sweatpant, stacked at the ankle'],
  ['/lookbook/look-04-tall.jpg', 'Hoodie and sweatpant worn as a set'],
  ['/lookbook/look-05.jpg', '450 GSM garment-dyed fleece'],
  ['/lookbook/look-06.jpg', 'Onyx Black, full length'],
  ['/lookbook/look-07-tall.jpg', 'Warm Cream, full length'],
  ['/lookbook/look-08.jpg', 'The set, from behind'],
  ['/lookbook/look-09.jpg', 'Oversized through the body, dropped at the shoulder'],
  ['/lookbook/look-10-tall.jpg', 'AW2026'],
];

const lookbook = () =>
  [
    `<p>Two pieces, two colourways, photographed as they are worn. `,
    `<a href="/shop">Shop AW2026</a>.</p>`,
    `<div class="hdt-lookbook-grid">`,
    ...LOOKBOOK.map(
      ([src, alt]) =>
        `<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" width="1200" height="1500"></figure>`,
    ),
    `</div>`,
  ].join('');

/* -------------------------------------------------------------- contact */

const contact = () => [
  `<p>Questions about fit, an order, or a return &mdash; email`,
  ` <a href="mailto:info@otrace.co">info@otrace.co</a> and a person will answer.</p>`,
  `<h2>Before you write</h2>`,
  `<p><strong>Sizing.</strong> Every measurement we have is on the`,
  ` <a href="/sizing">sizing page</a>, garment-flat in centimetres.</p>`,
  `<p><strong>Delivery.</strong> In-stock AW2026 pieces ship in 3&ndash;5 business`,
  ` days inside the United States, and delivery is free on every order.</p>`,
  faqBlock('RETURNS_FAQS', FAQS.RETURNS_FAQS[0].question),
  `<h2>The label</h2>`,
  `<p>OTRACE makes heavyweight, garment-dyed fleece in small runs. Two pieces this`,
  ` season, cut oversized and dyed after they are sewn.`,
  ` <a href="/garment-dyed">How that is done</a>.</p>`,
].join('');

/* ----------------------------------------------------------------------- */

export const PAGES = {
  sizing: {
    title: 'Sizing',
    page_title: 'Size guide — OTRACE',
    description:
      'Oversized hoodie size chart and wide-leg sweatpant measurements for OTRACE, garment-flat in centimetres.',
    content: sizing,
  },
  'garment-dyed': {
    title: 'What does garment dyed mean?',
    page_title: 'What does garment dyed mean? — OTRACE',
    description:
      'Garment dyed means sewn first and dyed after, so the colour settles into the seams. OTRACE uses it on 450 GSM cotton fleece.',
    content: garmentDyed,
  },
  lookbook: {
    title: 'Lookbook AW2026',
    page_title: 'Lookbook AW2026 — OTRACE',
    description: 'The OTRACE AW2026 collection, worn. Two pieces in Onyx Black and Warm Cream.',
    content: lookbook,
  },
  contact: {
    title: 'Contact',
    page_title: 'Contact — OTRACE',
    description: 'Questions about fit, an order or a return. Email info@otrace.co.',
    content: contact,
  },
};

/** Build one page's scope, or null when the handle is not ours. */
export function pageContent(handle) {
  const page = PAGES[handle];
  if (!page) return null;
  return {
    title: page.title,
    page_title: page.page_title,
    page_description: page.description,
    content: page.content(),
  };
}

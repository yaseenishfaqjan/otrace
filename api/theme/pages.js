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

const SHIP_COPY =
  'We ship worldwide to the address you enter at checkout, including the United Kingdom and the rest of the world. Delivery is free inside the United States, and in-stock orders leave in 3–5 business days. Checkout does not add an international carrier fee, because none is configured.';

/** Digits only, 8–15. Empty when the env is unset, so the button stays hidden. */
function whatsappHref() {
  const raw = process.env.WHATSAPP_NUMBER
    || process.env.PUBLIC_WHATSAPP_NUMBER
    || process.env.VITE_WHATSAPP_NUMBER
    || '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  return `https://wa.me/${digits}`;
}

/** Optional chat embeds. A missing id renders nothing — never a fake agent. */
function chatEmbed() {
  const crisp = String(process.env.CRISP_WEBSITE_ID || '').trim();
  if (/^[a-f0-9-]{8,64}$/i.test(crisp)) {
    return `<script>window.$crisp=[];window.CRISP_WEBSITE_ID=${JSON.stringify(crisp)};</script><script async src="https://client.crisp.chat/l.js"></script>`;
  }
  const property = String(process.env.TAWK_PROPERTY_ID || '').trim();
  const widget = String(process.env.TAWK_WIDGET_ID || '').trim();
  if (/^[a-z0-9]{8,32}$/i.test(property) && /^[a-z0-9]{8,32}$/i.test(widget)) {
    return `<script async src=${JSON.stringify(`https://embed.tawk.to/${property}/${widget}`)}></script>`;
  }
  return '';
}

const inches = (cm) => (Math.round((cm / 2.54) * 10) / 10).toFixed(1);

/**
 * A missing cell is estimated only from the sizes on either side of it.
 * One missing neighbor, or a gap wider than one size, stays blank.
 */
function estimateCell(values, index) {
  const value = values[index];
  if (value != null) return { cm: value, estimated: false };
  const prev = values[index - 1];
  const next = values[index + 1];
  if (prev == null || next == null) return { cm: null, estimated: false };
  return { cm: Math.round((prev + next) / 2), estimated: true };
}

function sizeCell(cell) {
  if (cell.cm == null) return '<td class="is-blank">&mdash;</td>';
  const est = cell.estimated
    ? '<span class="hdt-size-est">est.</span>'
    : '';
  const cls = cell.estimated ? ' class="is-estimated"' : '';
  return `<td${cls}><span class="hdt-size-cm">${cell.cm}</span><span class="hdt-size-in">${inches(cell.cm)} in</span>${est}</td>`;
}

function sizeTable(labels) {
  const rows = SIZE_CHART.rows.filter((row) => labels.includes(row.label));
  const head = SIZE_CHART.sizes.map((s) => `<th scope="col">${esc(s)}</th>`).join('');
  const body = rows.map((row) => {
    const cells = row.values.map((_, i) => sizeCell(estimateCell(row.values, i))).join('');
    return `<tr><th scope="row">${esc(row.label)}</th>${cells}</tr>`;
  }).join('');
  const estimated = rows.some((row) => row.values.some((_, i) => estimateCell(row.values, i).estimated));
  const note = estimated
    ? '<p class="hdt-size-note">Cells marked est. are estimated from the neighboring sizes. They are not factory measurements.</p>'
    : '';
  return `<div class="hdt-size-scroll"><table class="hdt-size-chart"><thead><tr><th scope="col">Measurement</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${note}`;
}

const HOODIE_SVG = `<svg class="hdt-fit-drawing" viewBox="0 0 160 180" aria-hidden="true"><path d="M48 28c8-10 56-10 64 0l18 22-16 10-6-8v88H52V52l-6 8-16-10z"/><path d="M70 26c4 10 16 10 20 0"/></svg>`;
const PANT_SVG = `<svg class="hdt-fit-drawing" viewBox="0 0 160 180" aria-hidden="true"><path d="M48 18h64l-6 150H90l-10-78-10 78H54z"/></svg>`;

/* ---------------------------------------------------------------- sizing */

const sizing = () => [
  `<div class="hdt-size-page">`,
  `<p class="hdt-size-lead">Measurements are in centimetres, taken garment-flat. Inches are the centimetre figure divided by 2.54. Lay a piece you already own flat and compare rather than measuring your body.</p>`,
  `<section class="hdt-size-block">`,
  HOODIE_SVG,
  `<h2>Oversized hoodie</h2>`,
  `<p>Chest, body length, shoulder, and the sleeve/waist row from the spec sheet. The sheet does not say whether that last row is a sleeve or a waist, so the label stays as written.</p>`,
  sizeTable(['Chest', 'Body length', 'Shoulder', 'Sleeve / waist']),
  `</section>`,
  `<section class="hdt-size-block">`,
  PANT_SVG,
  `<h2>Wide-leg sweatpant</h2>`,
  `<p>Outseam, inseam, and leg opening. The waist is cut true to size and the leg is left wide, with a ribbed ankle.</p>`,
  sizeTable(['Outseam', 'Inseam', 'Leg opening']),
  `</section>`,
  `<h2>Fit</h2>`,
  `<p>${esc(PRODUCTS['OT-HOOD'].name)} is cut oversized. Take your usual size for the intended fit, or size down for a cleaner line. ${esc(PRODUCTS['OT-PANT'].name)} is cut wide from the hip and left to break at the ankle. Both are unisex, XS to 3XL, and the chart is the same garment-flat measurement for every body.</p>`,
  `</div>`,
].join('');

/* --------------------------------------------------------- garment dyed */

const garmentDyed = () => {
  const hood = PRODUCTS['OT-HOOD'];
  const pant = PRODUCTS['OT-PANT'];
  const meaning = faq('GARMENT_DYE_FAQS', 'What does garment dyed mean?');
  return [
    `<div class="hdt-dye">`,
    `<p class="hdt-dye-lead">${esc(meaning.answer)}</p>`,
    `<div class="hdt-dye-hero">`,
    `<figure><img src="/products/hoodie-onyx-front.jpg" alt="OTRACE oversized hoodie in Onyx Black, front" width="819" height="1024"></figure>`,
    `<figure><img src="/products/hoodie-cream-front.jpg" alt="OTRACE oversized hoodie in Warm Cream, front" width="819" height="1024"></figure>`,
    `</div>`,
    `<ol class="hdt-dye-steps" aria-label="Order of the dye">`,
    `<li><span>01</span>Knit</li>`,
    `<li><span>02</span>Cut</li>`,
    `<li><span>03</span>Sew</li>`,
    `<li class="is-last"><span>04</span>Dye the finished garment</li>`,
    `</ol>`,
    `<svg class="hdt-dye-svg" viewBox="0 0 640 88" role="img" aria-label="The colour goes on after the garment is sewn">`,
    `<line class="hdt-dye-line" x1="36" y1="28" x2="604" y2="28"/>`,
    `<circle cx="36" cy="28" r="5"/><circle cx="220" cy="28" r="5"/><circle cx="404" cy="28" r="5"/>`,
    `<circle class="is-last" cx="604" cy="28" r="7"/>`,
    `<text x="36" y="64">Knit</text><text x="220" y="64">Cut</text><text x="404" y="64">Sew</text><text class="is-last" x="604" y="64">Dye</text>`,
    `</svg>`,
    `<p>The fleece is knit, cut, and sewn, and only then dyed. Seams, rib and body go through the dye together. Two pieces from the same lot match. A later lot can sit a step lighter or darker, which is the process.</p>`,
    `<p>AW2026 is two pieces in that fleece: the <a href="/product/${hood.slug}">${esc(hood.name)}</a> at ${price('OT-HOOD')} and the <a href="/product/${pant.slug}">${esc(pant.name)}</a> at ${price('OT-PANT')}, in Onyx Black and Warm Cream. ${esc(SHIP_COPY)}</p>`,
    `<div class="hdt-dye-details">`,
    `<figure><img src="/detail-fabric.jpg" alt="Close view of the 450 GSM garment-dyed fleece" width="1200" height="1500"><figcaption>450 GSM fleece</figcaption></figure>`,
    `<figure><img src="/detail-stitch.jpg" alt="Stitch line that has taken the garment dye" width="1200" height="1500"><figcaption>Dye in the stitch</figcaption></figure>`,
    `<figure><img src="/detail-drawcord.jpg" alt="White moulded plastic drawcord tip" width="1200" height="1500"><figcaption>Moulded drawcord tip</figcaption></figure>`,
    `</div>`,
    faqBlock('GARMENT_DYE_FAQS', 'Garment dyed vs piece dyed'),
    `<p>Yarn-dyed cloth is coloured before it is knit. Piece-dyed cloth is coloured as fabric, then cut. Garment dyeing is the last of the three, which is why the stitch lines on an OTRACE piece take the colour instead of sitting on top of it.</p>`,
    faqBlock('GARMENT_DYE_FAQS', 'Does garment dye fade?'),
    `<h2>Care</h2>`,
    `<p>Machine wash cold, inside out. Tumble dry low. Do not iron the embroidery on the hoodie. The same care is on each product page.</p>`,
    `</div>`,
  ].join('');
};

/* ------------------------------------------------------------- lookbook */

/*
 * Eight frames, paired.
 *
 * The first row is the two mixed sets: Onyx hoodie with the cream sweatpant,
 * and the cream hoodie with the Onyx sweatpant. The stairwell (look-08) and
 * the second cream-seated frame (look-07) are left out — one is mostly the
 * architecture, the other repeats look-02. Width and height are the files.
 */
const LOOKBOOK = [
  ['/lookbook/look-10-tall.jpg', 1005, 1800, 'A model at the end of a concrete tunnel in the Onyx Black hoodie and Warm Cream sweatpant'],
  ['/lookbook/look-06.jpg', 1344, 1800, 'A model leans on a concrete wall in the Warm Cream hoodie and Onyx Black sweatpant'],
  ['/lookbook/look-01-tall.jpg', 1005, 1800, 'A model walks down a long concrete corridor in the Onyx Black hoodie and sweatpant'],
  ['/lookbook/look-02.jpg', 1344, 1800, 'A model sits on concrete steps in the Warm Cream hoodie and sweatpant'],
  ['/lookbook/look-04-tall.jpg', 1005, 1800, 'Two models in a vast concrete hall, one in Onyx Black and one in Warm Cream'],
  ['/lookbook/look-03.jpg', 1344, 1800, 'A model stands in window light, hood up, in the Onyx Black set'],
  ['/lookbook/look-09.jpg', 1344, 1800, 'Detail of the Onyx Black hoodie, logo and white moulded drawcord tips'],
  ['/lookbook/look-05.jpg', 1344, 1800, 'Close crop of the Warm Cream hoodie, logo and white moulded drawcord tips'],
];

const lookbook = () =>
  [
    `<p class="hdt-lookbook-lead">Two pieces, two colourways, photographed as they are worn. `,
    `<a href="/shop">Shop AW2026</a>.</p>`,
    `<div class="hdt-lookbook-grid">`,
    ...LOOKBOOK.map(
      ([src, width, height, alt]) =>
        `<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" width="${width}" height="${height}"></figure>`,
    ),
    `</div>`,
  ].join('');

/* -------------------------------------------------------------- contact */

const contact = () => {
  const wa = whatsappHref();
  const waButton = wa
    ? `<a class="hdt-contact-wa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`
    : '';
  return [
    `<div class="hdt-contact-page">`,
    `<p class="hdt-contact-lead">A person reads every note. Email <a href="mailto:info@otrace.co">info@otrace.co</a> or use the form.</p>`,
    `<p class="hdt-contact-actions"><a class="hdt-contact-mail" href="mailto:info@otrace.co">info@otrace.co</a>${waButton}</p>`,
    `<form id="otrace-contact" class="hdt-contact-form" method="post" action="/api/contact">`,
    `<label>Name<input name="name" autocomplete="name" required maxlength="255"></label>`,
    `<label>Email<input name="email" type="email" autocomplete="email" required maxlength="255"></label>`,
    `<label>Subject<input name="subject" maxlength="255"></label>`,
    `<label>Type<select name="inquiryType" required>`,
    `<option value="order">Order</option>`,
    `<option value="sizing">Sizing</option>`,
    `<option value="wholesale">Wholesale</option>`,
    `<option value="other">Something else</option>`,
    `</select></label>`,
    `<label>Message<textarea name="message" required maxlength="5000" rows="6"></textarea></label>`,
    `<button type="submit">Send</button>`,
    `<p id="otrace-contact-note" class="hdt-contact-note" role="status"></p>`,
    `</form>`,
    `<h2>Before you write</h2>`,
    `<p><strong>Sizing.</strong> Every measurement we have is on the <a href="/sizing">sizing page</a>, garment-flat, in centimetres and inches.</p>`,
    `<p><strong>Delivery.</strong> ${esc(SHIP_COPY)}</p>`,
    faqBlock('RETURNS_FAQS', FAQS.RETURNS_FAQS[0].question),
    `<h2>The label</h2>`,
    `<p>OTRACE makes heavyweight, garment-dyed fleece in small runs. Two pieces this season, cut oversized and dyed after they are sewn. <a href="/garment-dyed">How that is done</a>.</p>`,
    `<aside class="hdt-help"><details><summary>Help</summary>`,
    `<a href="mailto:info@otrace.co">Email info@otrace.co</a>`,
    wa ? `<a href="${esc(wa)}">WhatsApp</a>` : '',
    `<a href="/sizing">Sizing</a><a href="/shipping">Shipping</a><a href="/garment-dyed">Garment dyed</a>`,
    `</details></aside>`,
    chatEmbed(),
    `<script>(function(){var help=document.querySelector('.hdt-help');if(help&&help.parentNode!==document.body)document.body.appendChild(help);var form=document.getElementById('otrace-contact');if(!form)return;form.addEventListener('submit',function(event){event.preventDefault();var note=document.getElementById('otrace-contact-note');note.textContent='Sending…';var data={name:form.name.value,email:form.email.value,subject:form.subject.value,inquiryType:form.inquiryType.value,message:form.message.value};fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(res){return res.json().then(function(body){return{ok:res.ok,body:body};});}).then(function(result){if(!result.ok){note.textContent=(result.body&&result.body.error)||'Could not send that.';return;}form.reset();note.textContent='Sent. A person will reply at the email you gave.';}).catch(function(){note.textContent='Could not send that. Email info@otrace.co instead.';});});})();</script>`,
    `</div>`,
  ].join('');
};

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

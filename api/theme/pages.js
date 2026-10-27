/**
 * The content pages, built from shared data rather than retyped.
 *
 * Every number here comes from a single source - prices from api/catalog.js,
 * measurements from shared/size-chart.json, FAQ copy from shared/faqs.json -
 * because the page these replaced had hard-coded prices in its prose and
 * kept quoting them on the live site long after the prices changed. Prose
 * that restates a number always ends up lying about it.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, SET_LIST_CENTS, SET_TOTAL_CENTS, formatMoney } from '../catalog.js';

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
const listPrice = (sku) => formatMoney(PRODUCTS[sku].listPriceCents);

const SHIP_COPY =
  'We ship worldwide to the address you enter at checkout, including the United Kingdom and the rest of the world. Delivery is free inside the United States, and in-stock orders leave in 3–5 business days. Checkout does not add an international carrier fee, because none is configured.';

/** Digits only, 8–15. Empty when the env is unset, so the button stays hidden. */
export function whatsappHref() {
  const raw = process.env.WHATSAPP_NUMBER
    || process.env.PUBLIC_WHATSAPP_NUMBER
    || process.env.VITE_WHATSAPP_NUMBER
    || '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  return `https://wa.me/${digits}`;
}

/**
 * A real Instagram URL, or a bare handle. Empty when unset.
 * A handle is not invented here — the env has to name one.
 */
export function instagramHref() {
  const raw = String(
    process.env.INSTAGRAM_URL
    || process.env.VITE_INSTAGRAM_URL
    || process.env.VITE_INSTAGRAM
    || '',
  ).trim();
  if (!raw) return '';
  if (/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/i.test(raw)) return raw;
  if (/^[A-Za-z0-9._]{2,30}$/.test(raw)) return `https://instagram.com/${raw}`;
  return '';
}

/**
 * Optional Klaviyo onsite script. The private key stays on the server
 * (api/klaviyo.js). This public company id is a different value and is
 * omitted, not guessed, when the env is blank.
 */
export function klaviyoOnsite() {
  const id = String(process.env.KLAVIYO_COMPANY_ID || '').trim();
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return '';
  return `<script async src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(id)}"></script>`;
}

/** Optional chat embeds. A missing id renders nothing — never a fake agent. */
export function chatEmbed() {
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
    `<p>AW2026 is two pieces in that fleece: the <a href="/product/${hood.slug}">${esc(hood.name)}</a> at ${price('OT-HOOD')} (was ${listPrice('OT-HOOD')}) and the <a href="/product/${pant.slug}">${esc(pant.name)}</a> at ${price('OT-PANT')} (was ${listPrice('OT-PANT')}), in Onyx Black and Warm Cream. Together they are ${formatMoney(SET_TOTAL_CENTS)} (was ${formatMoney(SET_LIST_CENTS)}). ${esc(SHIP_COPY)}</p>`,
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
    `<p><strong>Delivery.</strong> ${esc(SHIP_COPY)} <a href="/shipping">Shipping and returns</a>.</p>`,
    faqBlock('RETURNS_FAQS', FAQS.RETURNS_FAQS[0].question),
    `<h2>The label</h2>`,
    `<p>OTRACE makes heavyweight, garment-dyed fleece in small runs. Two pieces this season, cut oversized and dyed after they are sewn. <a href="/garment-dyed">How that is done</a>. <a href="/about">About the label</a>.</p>`,
    instagramHref() ? `<p><a href="${esc(instagramHref())}">Instagram</a></p>` : '',
    `<aside class="hdt-help"><details><summary>Help</summary>`,
    `<a href="mailto:info@otrace.co">Email info@otrace.co</a>`,
    wa ? `<a href="${esc(wa)}">WhatsApp</a>` : '',
    `<a href="/sizing">Sizing</a><a href="/shipping">Shipping</a><a href="/garment-dyed">Garment dyed</a>`,
    `</details></aside>`,
    `<script>(function(){var help=document.querySelector('.hdt-help');if(help&&help.parentNode!==document.body)document.body.appendChild(help);var form=document.getElementById('otrace-contact');if(!form)return;form.addEventListener('submit',function(event){event.preventDefault();var note=document.getElementById('otrace-contact-note');note.textContent='Sending…';var data={name:form.name.value,email:form.email.value,subject:form.subject.value,inquiryType:form.inquiryType.value,message:form.message.value};fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(res){return res.json().then(function(body){return{ok:res.ok,body:body};});}).then(function(result){if(!result.ok){note.textContent=(result.body&&result.body.error)||'Could not send that.';return;}form.reset();note.textContent='Sent. A person will reply at the email you gave.';}).catch(function(){note.textContent='Could not send that. Email info@otrace.co instead.';});});})();</script>`,
    `</div>`,
  ].join('');
};

/* --------------------------------------------------------------- legal */

const about = () => [
  `<div class="hdt-prose">`,
  `<p>OTRACE started from a simple frustration: almost nobody makes a hoodie that still looks like itself after a year. Most are thin, printed in bulk, and cut to a shape that flatters a hanger.</p>`,
  `<p>So we made two pieces instead of twenty. A hoodie and a sweatpant, both from the same 450 GSM loopback fleece, both <a href="/garment-dyed">garment dyed</a> after they are sewn so the colour settles into the seams and softens rather than fades.</p>`,
  `<p>AW2026 is the first drop. Two colorways — Onyx Black and Warm Cream. Each piece is ${price('OT-HOOD')} (was ${listPrice('OT-HOOD')}). One of each together is ${formatMoney(SET_TOTAL_CENTS)} (was ${formatMoney(SET_LIST_CENTS)}).</p>`,
  `<div class="hdt-dye-details">`,
  `<figure><img src="/detail-fabric.jpg" alt="Macro detail of heavyweight loopback fleece" width="1200" height="1500"></figure>`,
  `<figure><img src="/detail-stitch.jpg" alt="Macro detail of a dropped shoulder seam" width="1200" height="1500"></figure>`,
  `</div>`,
  `<h2>How we make it</h2>`,
  `<p><strong>Knit.</strong> 450 GSM loopback cotton fleece, brushed on the inside. Heavy enough to hang properly from the shoulder.</p>`,
  `<p><strong>Cut.</strong> Boxy body, dropped shoulder, long enough in the hem to sit where it should rather than ride up.</p>`,
  `<p><strong>Dye.</strong> Dyed after sewing. The seams take the colour differently, so no two pieces are identical.</p>`,
  `<p><strong>Finish.</strong> White moulded plastic drawcord tips through metal eyelets, self-lined hood, internal branding tag.</p>`,
  `<p><a href="/shop">Shop AW2026</a> · <a href="/product/complete-set">The complete set</a></p>`,
  `</div>`,
].join('');

const shipping = () => {
  const returns = FAQS.RETURNS_FAQS[0];
  return [
    `<div class="hdt-prose">`,
    `<h2>Dispatch</h2>`,
    `<p>${esc(SHIP_COPY)} We email tracking when a parcel leaves.</p>`,
    `<h2>Where we ship</h2>`,
    `<p>The United Kingdom and the rest of the world, to the address on the order. Free delivery applies to United States addresses.</p>`,
    `<h2>${esc(returns.question)}</h2>`,
    `<p>${esc(returns.answer)}</p>`,
    `<h2>Something wrong</h2>`,
    `<p>If a piece arrives faulty or is not what you ordered, tell us within 30 days and we make it right at our cost — no return shipping charge.</p>`,
    `</div>`,
  ].join('');
};

const terms = () => [
  `<div class="hdt-prose">`,
  `<h2>Orders</h2>`,
  `<p>An order is an offer to buy. We confirm by email once payment has been taken. If we cannot fulfil an order we refund it in full.</p>`,
  `<h2>Dispatch</h2>`,
  `<p>Payment is taken when the order is placed. In-stock pieces ship within 3–5 business days. We email tracking when the parcel leaves us.</p>`,
  `<h2>Pricing</h2>`,
  `<p>Prices are in US dollars and shown before tax. A single piece is ${price('OT-HOOD')} (was ${listPrice('OT-HOOD')}). One hoodie and one sweatpant together are ${formatMoney(SET_TOTAL_CENTS)} (was ${formatMoney(SET_LIST_CENTS)}). Tax is calculated at checkout based on your delivery address. Prices can change, but never for an order already placed.</p>`,
  `<h2>Payment</h2>`,
  `<p>Payments are processed by Stripe. We never see or store your card details.</p>`,
  `<h2>Colour and imagery</h2>`,
  `<p>We photograph our pieces as accurately as we can, but screens vary and garment dyeing means small variation between pieces is normal — it is the process, not a fault.</p>`,
  `</div>`,
].join('');

const privacy = () => [
  `<div class="hdt-prose">`,
  `<h2>What we collect</h2>`,
  `<p>When you order: your name, email, delivery address and phone number, so we can ship to you and reach you about the order. When you join the list: your email, the page you joined from, and any size, colour or phone number you choose to add. SMS and WhatsApp stay off unless you tick them separately.</p>`,
  `<h2>What we never hold</h2>`,
  `<p>Card details. Payment happens on Stripe’s systems and we only ever receive a confirmation that it succeeded.</p>`,
  `<h2>Who else sees it</h2>`,
  `<p>Stripe for payment, our carrier for delivery, and our email provider for order confirmations. When the list is connected to an email platform, that platform receives the same signup so it can send what you asked for. We do not sell data.</p>`,
  `<h2>Removing your data</h2>`,
  `<p>Email us and we delete your details, other than the order records we are required to keep for tax purposes. Every marketing email carries a one-click unsubscribe.</p>`,
  `</div>`,
].join('');

const account = () => [
  `<div class="hdt-prose">`,
  `<p>Every order confirmation email carries your order number and a receipt. Reply to that email with any change and we will handle it before it ships.</p>`,
  `<p>There is no sign-in on this shop. Saved addresses and an order history are not switched on, so this page does not pretend a password would open them.</p>`,
  `<p><a href="/contact">Contact us</a> · <a href="/shop">Keep shopping</a></p>`,
  `</div>`,
].join('');

const wishlist = () => [
  `<div class="hdt-prose">`,
  `<p>Hearts on this shop are saved in this browser only. They are not an account, and they are not copied to our server.</p>`,
  `<div id="otrace-wishlist-items"><p>Nothing saved in this browser yet.</p></div>`,
  `<p><a href="/shop">Shop AW2026</a> · <a href="/cart">Cart</a></p>`,
  `<script>(function(){var root=document.getElementById('otrace-wishlist-items');if(!root)return;var raw='';try{raw=localStorage.getItem('theme4:wishlist:id')||'';}catch(e){}var ids=raw.split(',').map(function(s){return s.trim();}).filter(Boolean);var known={'OT-HOOD':'/product/oversized-hoodie','OT-PANT':'/product/wide-leg-sweatpant','oversized-hoodie':'/product/oversized-hoodie','wide-leg-sweatpant':'/product/wide-leg-sweatpant'};function hrefFor(id){if(known[id])return known[id];var sku=id.split('--')[0];return known[sku]||'';}function labelFor(id){if(id.indexOf('OT-HOOD')===0||id==='oversized-hoodie')return 'Oversized Hoodie';if(id.indexOf('OT-PANT')===0||id==='wide-leg-sweatpant')return 'Wide-Leg Sweatpant';return id;}root.textContent='';if(!ids.length){var empty=document.createElement('p');empty.textContent='Nothing saved in this browser yet. The heart on a product stores it here, on this device only.';root.appendChild(empty);return;}var list=document.createElement('ul');ids.forEach(function(id){var li=document.createElement('li');var href=hrefFor(id);if(href){var a=document.createElement('a');a.href=href;a.textContent=labelFor(id);li.appendChild(a);}else{li.textContent=id;}list.appendChild(li);});root.appendChild(list);})();</script>`,
  `</div>`,
].join('');

const orderSuccess = () => [
  `<div class="hdt-prose">`,
  `<p>Order confirmed</p>`,
  `<p>Your order is in. A confirmation with your receipt is on its way to your inbox now, and we email tracking the moment it ships.</p>`,
  `<p>In-stock orders ship within 3–5 business days. We email tracking the moment the parcel leaves us.</p>`,
  `<p><a href="/shop">Keep shopping</a> · <a href="/account">Your orders</a></p>`,
  `</div>`,
].join('');

/** Logo-side flat for one colour. Same files the product galleries use. */
const frontShot = (product, colourName) => {
  const colorway = (product.colorways ?? []).find((c) => c.name === colourName);
  const images = colorway?.images ?? [];
  return images.find((img) => img.label === 'Front') ?? images[0] ?? null;
};

const setShot = (product, colourName, hidden) => {
  const shot = frontShot(product, colourName);
  if (!shot?.src) return '';
  return `<figure data-set-colour="${esc(colourName)}"${hidden ? ' hidden' : ''}><img src="${esc(shot.src)}" alt="${esc(shot.alt || product.name)}" width="${Number(shot.width) || 819}" height="${Number(shot.height) || 1024}"></figure>`;
};

const completeSet = () => {
  const hood = PRODUCTS['OT-HOOD'];
  const pant = PRODUCTS['OT-PANT'];
  // Both pieces share a colour, or the pair would be a mixed set the form cannot buy.
  const colours = (hood.colours ?? []).filter((name) =>
    (pant.colours ?? []).includes(name) && frontShot(hood, name) && frontShot(pant, name));
  const options = colours.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  const sizes = hood.sizes.map((size) => `<option value="${esc(size)}">${esc(size)}</option>`).join('');
  const figures = colours.flatMap((name, index) => [
    setShot(hood, name, index !== 0),
    setShot(pant, name, index !== 0),
  ]).join('');
  return [
    `<div class="hdt-prose hdt-set">`,
    `<p>One ${esc(hood.name)} and one ${esc(pant.name)}, same size and colour. Together they are <strong>${formatMoney(SET_TOTAL_CENTS)}</strong> (was ${formatMoney(SET_LIST_CENTS)}). Each piece on its own is ${price('OT-HOOD')} (was ${listPrice('OT-HOOD')}).</p>`,
    `<div class="hdt-dye-hero hdt-set-gallery" id="otrace-set-gallery">`,
    figures,
    `</div>`,
    `<form id="otrace-set" class="hdt-contact-form">`,
    `<label>Colour<select name="colour" required>${options}</select></label>`,
    `<label>Size<select name="size" required>${sizes}</select></label>`,
    `<button type="submit">Add the set — ${formatMoney(SET_TOTAL_CENTS)}</button>`,
    `<p id="otrace-set-note" class="hdt-contact-note" role="status"></p>`,
    `</form>`,
    `<p>Or buy them separately: <a href="/product/${hood.slug}">${esc(hood.name)}</a> · <a href="/product/${pant.slug}">${esc(pant.name)}</a>.</p>`,
    `<script>(function(){var form=document.getElementById('otrace-set');var gallery=document.getElementById('otrace-set-gallery');if(!form)return;function handle(label){return String(label).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}function showColour(){if(!gallery||!form.colour)return;var colour=form.colour.value;var nodes=gallery.querySelectorAll('[data-set-colour]');for(var i=0;i<nodes.length;i++){nodes[i].hidden=nodes[i].getAttribute('data-set-colour')!==colour;}}if(form.colour){var params=new URLSearchParams(window.location.search);var wanted=(params.get('colour')||params.get('color')||'').toLowerCase();if(wanted){for(var j=0;j<form.colour.options.length;j++){var value=form.colour.options[j].value;if(value.toLowerCase()===wanted||handle(value)===wanted){form.colour.value=value;break;}}}form.colour.addEventListener('change',showColour);form.colour.addEventListener('input',showColour);showColour();}form.addEventListener('submit',function(event){event.preventDefault();var note=document.getElementById('otrace-set-note');note.textContent='Adding…';var colour=form.colour.value;var size=form.size.value;var root=(window.Shopify&&Shopify.routes&&Shopify.routes.root)||'/api/theme-preview/';var items=[{id:'OT-HOOD-'+handle(colour)+'-'+handle(size),quantity:1},{id:'OT-PANT-'+handle(colour)+'-'+handle(size),quantity:1}];fetch(root+'cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})}).then(function(res){return res.json().then(function(body){return{ok:res.ok,body:body};});}).then(function(result){if(!result.ok){note.textContent=(result.body&&(result.body.message||result.body.description||result.body.error))||'Could not add the set.';return;}note.textContent='Both pieces are in the cart.';window.location.href='/cart';}).catch(function(){note.textContent='Could not add the set.';});});})();</script>`,
    `</div>`,
  ].join('');
};

export function standalonePage(kind) {
  const pages = {
    account: {
      title: 'Account',
      page_title: 'Account — OTRACE',
      description: 'Order lookup for OTRACE. Confirmations arrive by email. There is no sign-in yet.',
      noindex: true,
      content: account,
    },
    wishlist: {
      title: 'Wishlist',
      page_title: 'Wishlist — OTRACE',
      description: 'Pieces you heart are saved in this browser only. OTRACE does not keep a wishlist account.',
      noindex: true,
      content: wishlist,
    },
    'order-success': {
      title: 'Thank you',
      page_title: 'Order confirmed — OTRACE',
      description: 'Your OTRACE order is confirmed.',
      noindex: true,
      content: orderSuccess,
    },
    'complete-set': {
      title: 'Complete set',
      page_title: 'Complete set — OTRACE',
      description: `One OTRACE hoodie and one sweatpant together for ${formatMoney(SET_TOTAL_CENTS)}, was ${formatMoney(SET_LIST_CENTS)}. Each piece alone is ${price('OT-HOOD')}.`,
      noindex: false,
      content: completeSet,
      canonical_path: '/product/complete-set',
    },
  };
  const page = pages[kind];
  if (!page) return null;
  return {
    title: page.title,
    page_title: page.page_title,
    page_description: page.description,
    description: page.description,
    content: page.content(),
    noindex: page.noindex,
    handle: kind,
    canonical_path: page.canonical_path || `/${kind === 'order-success' ? 'order/success' : kind}`,
  };
}

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
  about: {
    title: 'About the label',
    page_title: 'About the label — OTRACE',
    description:
      'OTRACE makes fewer, heavier pieces: a 450 GSM garment-dyed hoodie and a wide-leg sweatpant.',
    content: about,
  },
  shipping: {
    title: 'Shipping & returns',
    page_title: 'Shipping & returns — OTRACE',
    description:
      'OTRACE ships worldwide. Delivery is free in the United States. In-stock AW2026 pieces ship in 3–5 business days, and unworn items can be returned within 30 days of delivery.',
    content: shipping,
  },
  terms: {
    title: 'Terms of service',
    page_title: 'Terms — OTRACE',
    description: 'Terms of sale for OTRACE orders: payment, delivery, returns and what happens if something goes wrong.',
    content: terms,
  },
  privacy: {
    title: 'Privacy',
    page_title: 'Privacy — OTRACE',
    description: 'How OTRACE collects, uses and protects the information you share when you order or sign up.',
    content: privacy,
  },
};

export function faqsForSlug(slug) {
  if (slug === 'oversized-hoodie') return FAQS.HOODIE_FAQS;
  if (slug === 'wide-leg-sweatpant') return FAQS.PANT_FAQS;
  if (slug === 'garment-dyed') return FAQS.GARMENT_DYE_FAQS;
  if (slug === 'shipping') return FAQS.RETURNS_FAQS;
  return [];
}

export function faqHtml(faqs) {
  if (!faqs?.length) return '';
  return `<section class="hdt-container hdt-section-spacing hdt-prose"><h2>Questions</h2>${
    faqs.map((f) => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join('')
  }</section>`;
}

/** Build one page's scope, or null when the handle is not ours. */
export function pageContent(handle) {
  const page = PAGES[handle];
  if (!page) return null;
  return {
    title: page.title,
    page_title: page.page_title,
    page_description: page.description,
    content: page.content(),
    handle,
    canonical_path: `/${handle}`,
  };
}

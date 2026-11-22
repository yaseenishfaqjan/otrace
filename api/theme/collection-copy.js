/**
 * On-page copy for the shelf pages and the lookbook.
 *
 * Measured 22 Nov 2026: /shop/hoodies and /shop/bottoms rendered 125 lines
 * each and differed by FOUR - the names on the product cards. Everything
 * else was nav and footer. Two indexable URLs saying the same thing, each
 * competing with /shop and with each other, and neither answering what
 * somebody searching "oversized hoodie" actually wants to know. /lookbook
 * was thinner still: 200 words, of which one sentence was its own.
 *
 * Every number here is READ from the catalogue - price, set price, sizes,
 * colourways, delivery window - because prose that restates a number is
 * prose that goes stale the first time the number moves. That has already
 * happened on this site: /garment-dyed sat on the live host quoting retired
 * prices for weeks.
 */
import { PRODUCTS, SET_TOTAL_CENTS, SHIPPING, SIZES, formatMoney } from '../catalog.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const FABRIC = '450 GSM garment-dyed heavyweight fleece';

const colourNames = (product) => (product.colorways ?? []).map((c) => c.name);

/** "XS to 2XL", from the real list, so a new size cannot be missed here. */
const sizeRange = () => `${SIZES[0]} to ${SIZES[SIZES.length - 1]}`;

const delivery = () =>
  `${SHIPPING.amountCents === 0 ? 'Free US delivery' : 'US delivery'}, `
  + `${SHIPPING.minDays}–${SHIPPING.maxDays} business days`;

/** A list of facts, which is what somebody scanning a shelf page reads. */
const specs = (rows) =>
  `<ul class="hdt-shelf-specs">${rows
    .map(([key, value]) => `<li><strong>${esc(key)}</strong> ${value}</li>`)
    .join('')}</ul>`;

const p = (html) => `<p>${html}</p>`;

const HOOD_LINK = '<a href="/product/oversized-hoodie">hoodie</a>';
const PANT_LINK = '<a href="/product/wide-leg-sweatpant">sweatpant</a>';
const SIZE_LINK = '<a href="/sizing">size guide</a>';
const DYE_LINK = '<a href="/garment-dyed">Garment dyeing</a>';

/**
 * The three shelves open differently on purpose. If the hoodie page and the
 * sweatpant page both lead with the fabric they are near-duplicates again,
 * just with more words - which is worse than the 241 they started from.
 */
function hoodieBody() {
  const product = PRODUCTS['OT-HOOD'];
  return [
    p('The OTRACE Oversized Hoodie is cut a full size large. The shoulder seam sits down the arm, '
      + 'the body is square rather than tapered, and the hood is self-lined so it stands up instead of '
      + 'collapsing flat. Take your usual size for the intended fit, or size down for a cleaner line.'),
    p(`It is made in ${esc(FABRIC)} — heavy enough to keep its shape through the wash rather than `
      + `hanging off the shoulder after a season. ${DYE_LINK} is what gives each piece its depth of `
      + 'colour, and why no two come out identical.'),
    specs([
      ['Weight', `${esc(FABRIC)}`],
      ['Fit', 'Boxy, dropped shoulder, cut a full size large'],
      ['Details', 'Self-lined hood, split kangaroo pocket, white moulded plastic drawcord tips through metal eyelets'],
      ['Colourways', esc(colourNames(product).join(' and '))],
      ['Sizes', `${esc(sizeRange())} — see the ${SIZE_LINK}`],
      ['Price', `${esc(formatMoney(product.priceCents))}, or ${esc(formatMoney(SET_TOTAL_CENTS))} with the ${PANT_LINK}`],
      ['Delivery', `${esc(delivery())}, <a href="/shipping">30-day returns</a>`],
    ]),
  ].join('');
}

function bottomsBody() {
  const product = PRODUCTS['OT-PANT'];
  return [
    p('The OTRACE Wide-Leg Sweatpant is relaxed from the hip and stays wide to the ankle, where a '
      + 'ribbed cuff stops it dragging. It is not a tapered jogger: the leg keeps its volume, which '
      + 'is the whole point of it.'),
    p(`Cut from the same ${esc(FABRIC)} as the hoodie, so the two wear in and fade together rather `
      + `than drifting apart. The waist is a drawcord with white moulded plastic tips. ${DYE_LINK} `
      + 'explains how the colour changes over time.'),
    specs([
      ['Weight', `${esc(FABRIC)}`],
      ['Fit', 'Wide through the thigh, straight to a ribbed ankle cuff'],
      ['Details', 'Drawcord waist with white moulded plastic tips, side seam pockets'],
      ['Colourways', esc(colourNames(product).join(' and '))],
      ['Sizes', `${esc(sizeRange())} — see the ${SIZE_LINK}`],
      ['Price', `${esc(formatMoney(product.priceCents))}, or ${esc(formatMoney(SET_TOTAL_CENTS))} with the ${HOOD_LINK}`],
      ['Delivery', `${esc(delivery())}, <a href="/shipping">30-day returns</a>`],
    ]),
  ].join('');
}

function allBody() {
  return [
    p(`AW2026 is two garments: an ${HOOD_LINK} and a ${PANT_LINK}, both in ${esc(FABRIC)}, both in `
      + `${esc(colourNames(PRODUCTS['OT-HOOD']).join(' and '))}. That is the whole collection, on purpose.`),
    p(`${esc(formatMoney(PRODUCTS['OT-HOOD'].priceCents))} each, or ${esc(formatMoney(SET_TOTAL_CENTS))} for the pair — `
      + 'the set price applies in the cart, so there is no bundle to hunt for. '
      + `${esc(delivery())}, with <a href="/shipping">30-day returns</a>.`),
    specs([
      ['Hoodies', '<a href="/shop/hoodies">Boxy, dropped shoulder, self-lined hood</a>'],
      ['Bottoms', '<a href="/shop/bottoms">Wide leg, ribbed ankle cuff</a>'],
      ['Sizes', `${esc(sizeRange())} — see the ${SIZE_LINK}`],
      ['Worn', '<a href="/lookbook">Both pieces photographed on the body</a>'],
    ]),
  ].join('');
}

const BODIES = { all: allBody, hoodies: hoodieBody, bottoms: bottomsBody };

/** The on-page copy for a shelf, or '' for a shelf that has none (search). */
export function collectionBody(handle) {
  const build = BODIES[handle];
  return build ? build() : '';
}

/**
 * A short visible caption per lookbook frame.
 *
 * NOT the alt text. The alt describes the photograph for somebody who cannot
 * see it; the caption names the pieces and links them, so the lookbook stops
 * being eight images with one sentence between them and starts pointing at
 * the things it is there to sell.
 */
export const LOOK_CAPTIONS = {
  '/lookbook/look-10-tall.jpg': `Onyx Black ${HOOD_LINK} with the Warm Cream ${PANT_LINK}`,
  '/lookbook/look-06.jpg': `Warm Cream ${HOOD_LINK} with the Onyx Black ${PANT_LINK}`,
  '/lookbook/look-01-tall.jpg': `The Onyx Black set — ${HOOD_LINK} and ${PANT_LINK}`,
  '/lookbook/look-02.jpg': `The Warm Cream set — ${HOOD_LINK} and ${PANT_LINK}`,
  '/lookbook/look-04-tall.jpg': 'Both colourways together, Onyx Black and Warm Cream',
  '/lookbook/look-03.jpg': `Hood up, in the Onyx Black ${HOOD_LINK}`,
  '/lookbook/look-09.jpg': `Drawcord and eyelet detail, Onyx Black ${HOOD_LINK}`,
  '/lookbook/look-05.jpg': `Drawcord and eyelet detail, Warm Cream ${HOOD_LINK}`,
};

export const lookCaption = (src) => LOOK_CAPTIONS[src] ?? '';

/** The lookbook intro. Says what the reader is looking at, and at what price. */
export function lookbookIntro() {
  return [
    p('AW2026 photographed as it is worn — two garments, two colourways, and the four ways they '
      + `combine. Every frame is the same ${esc(FABRIC)}; what changes is which colour sits on top.`),
    p(`The oversized ${HOOD_LINK} is cut a full size large with a dropped shoulder, and the wide-leg `
      + `${PANT_LINK} keeps its volume down to a ribbed ankle cuff. Both run ${esc(sizeRange())}. `
      + `${esc(formatMoney(PRODUCTS['OT-HOOD'].priceCents))} each, ${esc(formatMoney(SET_TOTAL_CENTS))} for the pair.`),
  ].join('');
}

export function lookbookOutro() {
  return p('Shop the <a href="/shop/hoodies">hoodie</a>, the <a href="/shop/bottoms">sweatpant</a>, '
    + 'or <a href="/shop">everything in AW2026</a>. Unsure of size? The '
    + `${SIZE_LINK} has the garment-flat measurements.`);
}

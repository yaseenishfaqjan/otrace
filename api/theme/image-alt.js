/**
 * One written alt text per image file, looked up by URL.
 *
 * Bing counts alt="" as a MISSING alt. URL Inspection reported 10 on the
 * homepage on 15 Nov 2026, and not one of them was decorative: the hero
 * slide, six lookbook frames, two product photos and the wordmark.
 *
 * They were empty because the theme hands `image_tag` a bare path in those
 * places - a section setting in templates/index.json, the footer logo in
 * footer-group.json - so there is no image object to read an alt off, and
 * the engine's lazily-learned map only knows a URL it has already seen
 * attached to an object. A registry keyed by URL answers whatever the
 * render order.
 *
 * None of this text is new. The product lines come from
 * shared/product-media.json, which has always carried them; the editorial
 * lines were written for the lookbook page and only ever rendered there.
 * This module is now the one place they live - pages.js reads them back
 * rather than restating them.
 */
import { readFileSync } from 'node:fs';

const media = JSON.parse(
  readFileSync(new URL('../../shared/product-media.json', import.meta.url), 'utf8'),
);

/**
 * Photography that is not a product shot. The lookbook page renders eight of
 * these; look-01-wide is the homepage hero crop and look-07-tall is a second
 * cream frame the lookbook leaves out, so both only ever appear elsewhere.
 */
export const EDITORIAL_ALT = {
  '/lookbook/look-01-wide.jpg': 'A model walks down a long concrete corridor in the Onyx Black hoodie and sweatpant',
  '/lookbook/look-01-tall.jpg': 'A model walks down a long concrete corridor in the Onyx Black hoodie and sweatpant',
  '/lookbook/look-02.jpg': 'A model sits on concrete steps in the Warm Cream hoodie and sweatpant',
  '/lookbook/look-03.jpg': 'A model stands in window light, hood up, in the Onyx Black set',
  '/lookbook/look-04-tall.jpg': 'Two models in a vast concrete hall, one in Onyx Black and one in Warm Cream',
  '/lookbook/look-05.jpg': 'Close crop of the Warm Cream hoodie, logo and white moulded drawcord tips',
  '/lookbook/look-06.jpg': 'A model leans on a concrete wall in the Warm Cream hoodie and Onyx Black sweatpant',
  '/lookbook/look-07-tall.jpg': 'A model seated against concrete in the Warm Cream hoodie and sweatpant',
  '/lookbook/look-09.jpg': 'Detail of the Onyx Black hoodie, logo and white moulded drawcord tips',
  '/lookbook/look-10-tall.jpg': 'A model at the end of a concrete tunnel in the Onyx Black hoodie and Warm Cream sweatpant',
  '/brand/otrace-wordmark.svg': 'OTRACE',
  '/brand/otrace-wordmark-embroidery.png': 'The OTRACE wordmark embroidered on garment-dyed fleece',
  '/brand/otrace-wordmark-embroidery.webp': 'The OTRACE wordmark embroidered on garment-dyed fleece',
};

const registry = new Map();
for (const product of Object.values(media)) {
  for (const colourway of product?.colorways ?? []) {
    for (const image of colourway?.images ?? []) {
      if (image?.src && image?.alt) registry.set(image.src, image.alt);
    }
  }
}
for (const [src, alt] of Object.entries(EDITORIAL_ALT)) registry.set(src, alt);

export const ALT_REGISTRY = registry;

/**
 * The alt for an image URL, or '' when we have not written one.
 *
 * Accepts an absolute URL or a path, with or without a query string. A .webp
 * falls back to its .jpg twin: the two are the same photograph and the
 * catalogue only names one of them.
 */
export function altForUrl(url) {
  if (!url) return '';
  const path = String(url).replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
  const hit = registry.get(path);
  if (hit) return hit;
  const jpg = path.replace(/\.webp$/i, '.jpg');
  return (jpg !== path && registry.get(jpg)) || '';
}

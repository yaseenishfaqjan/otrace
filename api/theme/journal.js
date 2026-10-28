/**
 * Journal HTML for the theme page template.
 *
 * The words come from site/src/content/posts.mjs, the same module the React
 * journal and the markdown mirrors read, so the three cannot drift.
 */
import { POSTS, journalBlurb } from '../../site/src/content/posts.mjs';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const linkRe = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

function inline(text) {
  let out = '';
  let last = 0;
  for (const match of String(text).matchAll(linkRe)) {
    const index = match.index ?? 0;
    out += esc(text.slice(last, index));
    const href = match[2];
    if (href.startsWith('/') && !href.startsWith('//')) {
      out += `<a href="${esc(href)}">${esc(match[1])}</a>`;
    } else {
      out += esc(match[0]);
    }
    last = index + match[0].length;
  }
  out += esc(String(text).slice(last));
  return out;
}

function figure(image) {
  if (!image?.src) return '';
  return `<figure class="hdt-journal-figure"><img src="${esc(image.src)}" alt="${esc(image.alt || '')}" loading="lazy"><figcaption>${esc(image.caption || '')}</figcaption></figure>`;
}

const DIAGRAM = {
  gsm: 'One square metre of this fleece weighs 450 grams. GSM is that weight, not a size.',
  dye: 'Piece dyeing colours the cloth before it is cut. Garment dyeing colours the sewn hoodie, so the seam takes the dye too.',
  fit: 'The body is cut square and the shoulder seam is dropped. Take your usual size for that room, or size down for a cleaner line.',
};

export function journalIndexHtml() {
  const cards = POSTS.map((post) => `
    <article class="hdt-journal-card">
      <a href="/blog/${esc(post.slug)}">
        <img src="${esc(post.hero.src)}" alt="${esc(post.hero.alt)}" width="640" height="800" loading="lazy">
        <p class="hdt-journal-eyebrow">${esc(post.eyebrow)}</p>
        <h2>${esc(post.h1)}</h2>
        <p>${esc(post.description)}</p>
      </a>
    </article>`).join('');
  return `<div class="hdt-journal">
    <p class="hdt-journal-lead otrace-fact">${esc(journalBlurb)} The notes answer what 450 GSM means, how garment dyed differs from piece dyed, and how an oversized hoodie should fit.</p>
    <div class="hdt-journal-list">${cards}</div>
  </div>`;
}

export function journalPostHtml(post) {
  const sections = post.sections.map((section) => `
    <section>
      <h2>${esc(section.h2)}</h2>
      ${section.paragraphs.map((paragraph) => `<p>${inline(paragraph)}</p>`).join('')}
      ${section.image ? figure(section.image) : ''}
    </section>`).join('');
  const diagram = DIAGRAM[post.diagram]
    ? `<p class="hdt-journal-diagram">${esc(DIAGRAM[post.diagram])}</p>`
    : '';
  return `<article class="hdt-journal hdt-journal-post">
    <p class="hdt-journal-eyebrow"><a href="/blog">Journal</a> / ${esc(post.eyebrow)}</p>
    <p class="hdt-journal-answer otrace-fact">${esc(post.answer)}</p>
    ${figure({ ...post.hero, caption: post.hero.caption })}
    ${diagram}
    ${sections}
  </article>`;
}

export function findPost(slug) {
  return POSTS.find((post) => post.slug === slug) || null;
}

export { POSTS, journalBlurb };

/**
 * Rendering the Kalles Shopify theme on our own server.
 *
 * The theme is Liquid, written against Shopify's object model: 11,389
 * references to `settings`, 2,817 to `section.settings`, 1,804 to `product`.
 * None of that needs Shopify - the settings ship in the theme's own JSON and
 * the product data is ours - but every Shopify FILTER and TAG the templates
 * use has to exist here or the render dies on the first one it meets.
 *
 * This file is that compatibility layer. It is deliberately small and
 * additive: anything missing shows up as a render error naming the filter,
 * which is a far better failure than a silently empty page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Liquid } from 'liquidjs';
import { colorBrightness, colorDarken, colorLighten, colorMix, fontFaceCss } from './shopify-color.js';

/** Shopify ships its template JSON with /* *\/ comments. */
/**
 * Strip comments from Shopify's JSONC, without touching string contents.
 *
 * A regex cannot do this safely: `"https://example.com"` contains `//`, and a
 * blanket strip truncates the URL and every line after it on that line. So walk
 * the text and track whether we are inside a string.
 */
export function stripJsonComments(text) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i++; }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; }
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '/' && next === '/') { inLine = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i++; continue; }
    out += ch;
  }
  return out;
}

/** Shopify's theme JSON carries comments AND trailing commas; JSON.parse takes neither. */
export const parseThemeJson = (text) =>
  JSON.parse(stripJsonComments(String(text).replace(/^﻿/, '')).replace(/,(\s*[}\]])/g, '$1'));

export const readThemeJson = (file) => parseThemeJson(fs.readFileSync(file, 'utf8'));


/**
 * Render one theme file from a NAMED directory.
 *
 * Deliberately not engine.renderFile(name): that searches the roots, and the
 * roots are snippets-only on purpose (see createEngine). A section and a
 * snippet may share a name, and on Shopify they never collide because each tag
 * looks in exactly one place. This keeps that guarantee.
 */
/**
 * Shopify accepts an EMPTY output tag; LiquidJS refuses to parse one.
 *
 * `{{- -}}` prints nothing and exists only for its whitespace control, and
 * Kalles uses it. LiquidJS rejects it as "invalid value expression", which
 * fails the whole section - the collection page rendered its header and footer
 * and no products at all.
 *
 * The dashes are honoured rather than dropped: a leading dash eats the
 * whitespace before the tag, a trailing one the whitespace after.
 */
export function stripEmptyOutputTags(source) {
  return String(source)
    .replace(/\s*\{\{-\s*-\}\}\s*/g, '')
    .replace(/\s*\{\{-\s*\}\}/g, '')
    .replace(/\{\{\s*-\}\}\s*/g, '')
    .replace(/\{\{\s*\}\}/g, '');
}

export async function renderThemeFile(engine, themeRoot, dir, name, scope, globals) {
  const overridden = path.join(themeRoot, '..', 'theme-overrides', `${name}.liquid`);
  const file = fs.existsSync(overridden) ? overridden : path.join(themeRoot, dir, `${name}.liquid`);
  if (!fs.existsSync(file)) throw new Error(`theme file not found: ${dir}/${name}.liquid`);
  // `globals` overrides the engine's own per RENDER, which is how a page sets
  // request.page_type without mutating state the next request also reads.
  const source = stripEmptyOutputTags(fs.readFileSync(file, 'utf8'));
  return engine.parseAndRender(source, scope, globals ? { globals } : undefined);
}

/**
 * Theme translations.
 *
 * Shopify resolves `| t` against locales/<locale>.json, and a theme leans on it
 * for nearly every visible string - so with no lookup the page renders raw keys
 * like `general.meta.page` in the TITLE. Loaded once per theme root and cached.
 */
const translationCache = new Map();

function loadTranslations(themeRoot, locale = 'en.default') {
  const cacheKey = `${themeRoot}|${locale}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
  let data = {};
  try {
    data = readThemeJson(path.join(themeRoot, 'locales', `${locale}.json`));
  } catch {
    // A theme with no locale file shows keys, which is the previous behaviour
    // and not a new failure. Never throw out of a translation lookup.
    data = {};
  }
  translationCache.set(cacheKey, data);
  return data;
}

/** Walk a dotted key (`general.meta.page`) through the nested locale object. */
function translate(data, key) {
  let node = data;
  for (const part of String(key).split('.')) {
    if (node == null || typeof node !== 'object') return null;
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Read a theme file's {% schema %} block.
 *
 * Returns null when there is none - every caller treats that as "no schema",
 * never as an error, because plenty of files legitimately have none.
 */
export function readSchema(themeRoot, dir, name) {
  const overridden = path.join(themeRoot, '..', 'theme-overrides', `${name}.liquid`);
  const file = fs.existsSync(overridden) ? overridden : path.join(themeRoot, dir, `${name}.liquid`);
  if (!fs.existsSync(file)) return null;
  const m = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(
    fs.readFileSync(file, 'utf8'),
  );
  if (!m) return null;
  try {
    return parseThemeJson(m[1]);
  } catch {
    return null;
  }
}

/**
 * Turn `link_list` settings from a stored HANDLE into the linklist OBJECT.
 *
 * Shopify stores "main-menu" in the template JSON but hands the theme the
 * resolved menu, so `section.settings.main_menu.links` works. Skip this and the
 * header prints its empty-menu notice: no error, no warning, just no menu.
 */
/**
 * JPEG and PNG dimensions, read from the file header.
 *
 * Banner and slideshow settings store a path, and the theme sizes the slot
 * from image.aspect_ratio. A bare string has no ratio, so the theme falls
 * back to 2:1 and crops a portrait hoodie into a strip of windows and a head.
 */
export function readImageSize(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const size = buf.readUInt16BE(offset + 2);
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof && offset + 9 < buf.length) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    if (size < 2) break;
    offset += 2 + size;
  }
  return null;
}

/** A theme image_picker path, as the object Liquid prints and measures. */
export function imageSetting(themeRoot, src, alt = '') {
  if (!src || typeof src !== 'string') return src;
  const rel = src.replace(/^\//, '');
  const dim = themeRoot ? readImageSize(path.join(themeRoot, '..', 'site', 'public', rel)) : null;
  const width = dim?.width || 1600;
  const height = dim?.height || 2000;
  return {
    src,
    url: src,
    alt,
    width,
    height,
    aspect_ratio: width / height,
    toString() { return src; },
    valueOf() { return src; },
  };
}

export function resolveLinkListSettings(schema, settings, linklists, themeRoot, blogs, productsByHandle, pages) {
  if (!schema) return settings ?? {};

  // Template JSON stores only the settings that were CHANGED, so everything
  // else arrives undefined and renders as an empty string. That is not just
  // cosmetic: the add-to-cart block writes its animation setting into a JSON
  // attribute, and an empty one becomes classList.add('') inside a setInterval
  // - an exception every tick, forever, which starves the page's other JS.
  const out = {};
  for (const setting of schema.settings ?? []) {
    if (!setting?.id) continue;
    if ('default' in setting) out[setting.id] = setting.default;
    // A select or radio with no declared default takes its FIRST option, as
    // Shopify does. The add-to-cart animation is one of these: its "off" value
    // is the string "none", and leaving it undefined is what produced
    // classList.add('') rather than a harmless unused class.
    else if ((setting.type === 'select' || setting.type === 'radio') && setting.options?.length) {
      out[setting.id] = setting.options[0].value;
    }
  }
  Object.assign(out, settings ?? {});

  for (const setting of schema.settings ?? []) {
    if (!setting?.id) continue;
    // A `link_list` setting is stored as a handle and must become the menu.
    if (setting.type === 'link_list') {
      const handle = out[setting.id];
      if (typeof handle === 'string') out[setting.id] = linklists?.[handle] ?? null;
    }
    // LiquidJS treats [] as truthy, so an empty product_list skips the
    // collection branch and the grid renders nothing. A list of handles has
    // to become product objects; a leftover demo handle is dropped so the
    // card does not fall through to the $19.99 placeholder.
    if (setting.type === 'product_list' && Array.isArray(out[setting.id])) {
      const resolved = out[setting.id]
        .map((item) => (typeof item === 'string' ? productsByHandle?.[item] ?? null : item))
        .filter(Boolean);
      out[setting.id] = resolved.length ? resolved : null;
    }
    if (setting.type === 'image_picker' && typeof out[setting.id] === 'string' && out[setting.id]) {
      out[setting.id] = imageSetting(themeRoot, out[setting.id]);
    }
    // A blog setting is a handle. Left as a string, `blog.articles` is empty
    // and the carousel prints six "Your post's title" placeholders.
    if (setting.type === 'blog' && typeof out[setting.id] === 'string') {
      out[setting.id] = blogs?.[out[setting.id]] ?? null;
    }
    // A product setting is a handle. A string is not blank, so the theme
    // renders it as a product and the missing fields become the $19.99
    // placeholder card.
    if (setting.type === 'product' && typeof out[setting.id] === 'string') {
      out[setting.id] = productsByHandle?.[out[setting.id]] ?? null;
    }
    // A page setting is stored as a handle. A non-empty string is not blank,
    // so the theme still opens the modal, but .title and .content do not
    // exist on a string and the dialog renders as an empty bar.
    if (setting.type === 'page' && typeof out[setting.id] === 'string') {
      const handle = out[setting.id].trim();
      out[setting.id] = handle ? (pages?.[handle] ?? null) : null;
    }
  }
  return out;
}

/**
 * Shopify wraps every rendered section in this element, and themes depend on
 * it: CSS selectors are written against `.shopify-section`, and the theme's JS
 * finds a section by `#shopify-section-<id>`. Omitting it costs layout and
 * behaviour with nothing to indicate why.
 */
/**
 * Template JSON stores blocks keyed by id. Shopify renders `block_order` and
 * skips `disabled`. Blocks left out of the order (static media the template
 * asks for by id) are appended so a named content_for can still find them.
 */
export const blockList = (blocks, order) => {
  if (Array.isArray(blocks)) return blocks;
  const map = blocks || {};
  const seen = new Set();
  const list = [];
  const consider = (id) => {
    if (!id || seen.has(id) || !map[id]) return;
    seen.add(id);
    if (map[id].disabled) return;
    list.push({ id, ...map[id] });
  };
  for (const id of order || []) consider(id);
  for (const id of Object.keys(map)) consider(id);
  return list;
};

export const wrapSection = (id, type, html) =>
  `<div id="shopify-section-${id}" class="shopify-section shopify-section-${type}">${html}</div>`;

/**
 * Text for an HTML attribute a Liquid filter received.
 *
 * `nil` is LiquidJS's NullDrop, not JavaScript null. The drop's valueOf is
 * null and it has no toString, so String(nil) is `[object Object]`. The logo
 * passes `widths: nil` to mean "do not emit widths"; Shopify omits that
 * attribute. A real widths list ("80, 160") is kept.
 */
function attributeText(value) {
  if (value == null || value === false) return null;
  if (typeof value === 'object') {
    const primitive = typeof value.valueOf === 'function' ? value.valueOf() : value;
    if (primitive == null || primitive === false) return null;
    if (typeof primitive !== 'object') {
      const text = String(primitive);
      return text === '' ? null : text;
    }
  }
  const text = String(value);
  if (text === '' || text === '[object Object]') return null;
  return text;
}

/**
 * Quantity of one variant already in the cart.
 *
 * Matches `variant_id` first. Our cart lines also store that id on `id` and
 * `variant.id`. An empty or missing cart is 0, which is what the quantity
 * label and `data-cart-quantity` print.
 */
export function itemCountForVariant(cart, variantId) {
  const wanted = variantId == null || typeof variantId === 'object' ? '' : String(variantId);
  if (!wanted) return 0;
  const items = cart && typeof cart === 'object' && Array.isArray(cart.items) ? cart.items : [];
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const id = item.variant_id ?? item.variant?.id ?? item.id;
    if (id != null && String(id) === wanted) count += Number(item.quantity) || 0;
  }
  return count;
}

export function createEngine(themeRoot, { assetBase = '/theme-assets', globals = {} } = {}) {
  const translations = loadTranslations(themeRoot);
  const lookupTranslation = (key) => translate(translations, key);
  /**
   * The search path is SNIPPETS ONLY, which is what {% render %} means on
   * Shopify. Flattening sections/, snippets/ and blocks/ into one path looks
   * harmless until two of them share a name: the theme ships both
   * sections/popover-currencies.liquid and snippets/popover-currencies.liquid,
   * and the section's only line is {% render 'popover-currencies' %} meaning
   * the snippet. With sections ahead of snippets that render resolved back to
   * the section and recursed forever - a synchronous hang with no error, which
   * cost a long bisect to find.
   *
   * Sections, blocks and layouts are therefore rendered by explicit path
   * through renderThemeFile below, never by bare name.
   */
  const engine = new Liquid({
    root: [
      // ours first, so a vendor file can be replaced without editing the theme
      path.join(themeRoot, '..', 'theme-overrides'),
      path.join(themeRoot, 'snippets'),
    ],
    extname: '.liquid',
    strictVariables: false,
    strictFilters: false,
    jsTruthy: true,
    // Shopify's `shop`, `settings`, `routes` and `request` are GLOBAL: they are
    // readable inside a snippet even though {% render %} isolates scope. In
    // LiquidJS an isolated scope sees globals only, so without this every
    // snippet renders them as empty - which is silent, and shows up far away as
    // a broken inline script or a missing class name.
    globals,
  });

  /* ---- Shopify tags that have no LiquidJS equivalent ---- */

  // {% schema %} is editor metadata, never output.
  engine.registerTag('schema', {
    parse(token, remain) {
      while (remain.length) {
        const t = remain.shift();
        if (t.name === 'endschema') break;
      }
    },
    render() { return ''; },
  });

  // {% style %} is just a <style> block.
  engine.registerTag('style', {
    parse(token, remain) {
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remain)
        .on('tag:endstyle', function () { this.stop(); })
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error('{% style %} not closed'); });
      stream.start();
    },
    * render(ctx, emitter) {
      emitter.write('<style>');
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      emitter.write('</style>');
    },
  });

  /* ---- Shopify filters ---- */

  const money = (cents) => {
    const n = Number(cents);
    if (!Number.isFinite(n)) return '';
    return '$' + (n / 100).toFixed(2);
  };

  engine.registerFilter('color_brightness', (value) => colorBrightness(value));
  engine.registerFilter('color_lighten', (value, amount) => colorLighten(value, amount));
  engine.registerFilter('color_darken', (value, amount) => colorDarken(value, amount));
  engine.registerFilter('color_mix', (value, other, amount) => colorMix(value, other, amount));
  engine.registerFilter('font_face', (variant) => fontFaceCss(variant));
  engine.registerFilter('money', money);
  // Shopify's time_tag prints a <time> in a strftime pattern. The journal
  // cards use "%b %d". Anything else falls back to that same short date.
  engine.registerFilter('time_tag', (date, format) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const text = `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`;
    const iso = d.toISOString().slice(0, 10);
    return `<time datetime="${iso}">${text}</time>`;
  });
  engine.registerFilter('money_with_currency', (c) => money(c) + ' USD');
  engine.registerFilter('money_without_currency', (c) => (Number(c) / 100).toFixed(2));
  engine.registerFilter('money_without_trailing_zeros', (c) => money(c).replace('.00', ''));

  engine.registerFilter('asset_url', (file) => `${assetBase}/${String(file).replace(/^\/+/, '')}`);
  engine.registerFilter('asset_img_url', (file) => `${assetBase}/${file}`);
  engine.registerFilter('file_url', (file) => `${assetBase}/${file}`);
  engine.registerFilter('shopify_asset_url', (file) => `${assetBase}/${file}`);

  /**
   * `shopify://` is a reference into a Shopify store's own files and pages. It
   * resolves to nothing here, and emitting it leaves a dead `src` in the page
   * rather than a visible error - so drop it and let the alt text show. Theme
   * config should carry real paths; this only catches what was missed.
   */
  const resolveImage = (src) => {
    const url = typeof src === 'string' ? src : (src && (src.src || src.url)) || '';
    return String(url).startsWith('shopify://') ? '' : url;
  };

  // image_url takes named args (width:, height:) in Shopify; ours are already sized.
  engine.registerFilter('image_url', resolveImage);
  engine.registerFilter('img_url', resolveImage);
  // Named args arrive as [name, value] pairs. Joining them made
  // `class,hdt-object-pos-mb`, so the hero image had a src and no class.
  engine.registerFilter('image_tag', (src, ...rest) => {
    const attrs = [`src="${resolveImage(src)}"`];
    for (const item of rest) {
      if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string') continue;
      const [name, value] = item;
      const text = attributeText(value);
      if (text == null) continue;
      attrs.push(`${name}="${text.replace(/"/g, '&quot;')}"`);
    }
    return `<img ${attrs.join(' ')}>`;
  });

  engine.registerFilter('stylesheet_tag', (href) => `<link rel="stylesheet" href="${href}">`);
  engine.registerFilter('script_tag', (src) => `<script src="${src}"></script>`);
  engine.registerFilter('preload_tag', () => '');

  engine.registerFilter('t', (key, ...rest) => {
    // Shopify passes interpolation values as named arguments, which LiquidJS
    // hands over as a trailing [name, value] list rather than one object.
    const args = {};
    for (const a of rest) {
      if (Array.isArray(a) && a.length === 2) args[a[0]] = a[1];
      else if (a && typeof a === 'object') Object.assign(args, a);
    }

    const value = lookupTranslation(String(key));
    // A key with no translation still shows the KEY, never an empty string:
    // a missing string must be visible, not invisible.
    if (value == null) return args.default ?? String(key);

    return String(value).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(args, name) ? String(args[name]) : m,
    );
  });
  engine.registerFilter('default_errors', (x) => x);
  engine.registerFilter('handleize', (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  engine.registerFilter('handle', (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  // Shopify's `json` emits `null` for a missing value. Returning undefined here
  // writes an EMPTY STRING into the page, which turns `a: {{ x | json }},` into
  // `a: ,` and makes the whole inline <script> a syntax error - taking out every
  // global the theme defines in it, with the only symptom a later
  // "themeHDN is not defined".
  engine.registerFilter('json', (v) => {
    const out = JSON.stringify(v === undefined ? null : v);
    return out === undefined ? 'null' : out;
  });
  engine.registerFilter('within', (url) => url);
  engine.registerFilter('link_to', (label, url) => `<a href="${url}">${label}</a>`);
  engine.registerFilter('placeholder_svg_tag', () => '<svg></svg>');
  engine.registerFilter('payment_type_svg_tag', () => '<svg></svg>');
  engine.registerFilter('inline_asset_content', () => '');
  engine.registerFilter('metafield_text', (v) => (v == null ? '' : String(v)));
  engine.registerFilter('highlight', (s) => s);
  engine.registerFilter('format_address', (a) => (a ? Object.values(a).filter(Boolean).join('<br>') : ''));
  engine.registerFilter('weight_with_unit', (g) => `${(Number(g) || 0) / 1000} kg`);

  /**
   * Shopify: `cart | item_count_for_variant: variant.id`.
   *
   * With the filter missing, LiquidJS returns the cart unchanged. The quantity
   * label then stringifies that object, so shoppers see `[object Object] in cart`,
   * and `cart_qty == 0` is false so the theme does not hide the label.
   */
  engine.registerFilter('item_count_for_variant', (cart, variantId) =>
    itemCountForVariant(cart, variantId));

  // {% content_for 'blocks' %} renders a section's theme-editor blocks. We have
  // no editor, so it renders the blocks the template JSON declares.
  engine.registerTag('content_for', {
    parse(token) { this.what = token.args || ''; },
    * render(ctx, emitter) {
      const section = ctx.get(['section']);
      const blocks = (section && section.blocks) || [];

      /**
       * {% content_for 'blocks' %} renders the blocks that have NOT already
       * been placed by name. main-product.liquid places the media block itself
       * and then calls 'blocks' for the rest; rendering everything both times
       * puts a SECOND complete product block on the page - no error, no
       * warning, just the whole page twice.
       */
      const args = String(this.what);
      const quoted = (re) => {
        const match = re.exec(args);
        return match ? (match[1] ?? match[2]) : undefined;
      };
      // Group 1 is the single-quoted capture. A double-quoted tag used to miss
      // it and was treated as content_for 'blocks', which dumped every block
      // into the first slot on the page.
      const kind = quoted(/'([^']*)'|"([^"]*)"/) || 'blocks';
      const wantType = quoted(/\btype:\s*(?:'([^']*)'|"([^"]*)")/);
      const wantId = quoted(/\bid:\s*(?:'([^']*)'|"([^"]*)")/);

      if (!ctx.registers.contentFor) ctx.registers.contentFor = new Set();
      const placed = ctx.registers.contentFor;
      const keyOf = (b) => `${section && section.id}|${b.id || b.type}`;

      let list;
      if (kind === 'block') {
        const found =
          (wantId && blocks.find((b) => b.id === wantId)) ||
          (wantType && blocks.find((b) => b.type === wantType)) ||
          null;
        // A named block the section JSON does not define is still rendered:
        // the theme asks for it by type and it may need no settings.
        list = found
          ? [found]
          : wantType
            ? [{ id: wantId || wantType, type: wantType, settings: {} }]
            : [];
      } else {
        list = blocks.filter((b) => !placed.has(keyOf(b)));
      }

      const linklists = ctx.get(['linklists']) || (ctx.globals && ctx.globals.linklists) || {};
      const blogs = ctx.get(['blogs']) || (ctx.globals && ctx.globals.blogs) || {};
      const productsByHandle = (ctx.globals && ctx.globals.productsByHandle) || {};
      const pages = ctx.get(['pages']) || (ctx.globals && ctx.globals.pages) || {};
      /**
       * Theme presets store `"article": "{{ closest.article }}"`. Shopify
       * fills that from the content_for argument. Left as text, the card
       * overwrites the real article with the braces and the title renders blank.
       */
      const closest = {};
      for (const match of String(args).matchAll(/closest\.(\w+)\s*:\s*(\w+)/g)) {
        closest[match[1]] = ctx.get([match[2]]);
      }
      for (const rawBlock of list) {
        const type = rawBlock && rawBlock.type;
        if (!type) continue;
        placed.add(keyOf(rawBlock));
        const blockSchema = readSchema(themeRoot, 'blocks', type);
        let blockSettings = resolveLinkListSettings(
          blockSchema, rawBlock.settings, linklists, themeRoot, blogs, productsByHandle, pages,
        );
        for (const [key, value] of Object.entries(blockSettings)) {
          if (typeof value !== 'string') continue;
          const placeholder = /^\{\{\s*closest\.(\w+)\s*\}\}$/.exec(value.trim());
          if (!placeholder) continue;
          const name = placeholder[1];
          blockSettings[key] = closest[name] ?? ctx.get([name]) ?? null;
        }

        /**
         * A setting declared `"type": "liquid"` holds a TEMPLATE, and Shopify
         * renders it. The page heading block is one: its value is literally
         * "{{ page.title }}", so without this the heading on every cart,
         * collection and page template reads as those braces.
         */
        for (const setting of blockSchema?.settings ?? []) {
          if (setting?.type !== 'liquid' || !setting.id) continue;
          const source = blockSettings[setting.id];
          if (typeof source !== 'string' || !source.includes('{')) continue;
          try {
            blockSettings = {
              ...blockSettings,
              [setting.id]: yield engine.parseAndRender(source, ctx.getAll(), {
                globals: ctx.globals,
              }),
            };
          } catch {
            // A setting we cannot render keeps its raw text rather than
            // blanking the block.
          }
        }

        const block = { ...rawBlock, settings: blockSettings };
        try {
          // theme/blocks is already a search root, so the bare type resolves.
          // 'blocks/<type>' only worked while the theme root was also a root,
          // and silently rendered nothing once it was not - the section fell
          // from 5573 bytes to 509 with no error at all.
          /**
           * A block's own children become the block list for anything nested
           * inside it. Passing the SECTION's list down instead means a block
           * that itself calls content_for re-renders all of its siblings,
           * including itself - blocks/_footer-column.liquid does exactly that,
           * and five footer columns recursed until the heap died.
           */
          const childScope = {
            ...ctx.getAll(),
            block,
            section: {
              ...(section || {}),
              blocks: blockList(block.blocks, block.block_order),
            },
          };
          // Snippets rendered from a block ({% render 'media' %}) only see globals.
          // product is a per-request global, not an engine default. Dropping it
          // here leaves the gallery unable to name a frame's colour, so every
          // slide stays hidden and the swatch cannot change the photo.
          emitter.write(yield renderThemeFile(engine, themeRoot, 'blocks', type, childScope, ctx.globals));
        } catch {
          // A block the theme ships but we cannot resolve is skipped rather
          // than fatal - one missing block must not blank the page.
        }
      }
    },
  });

  // {% form 'product', product %} ... {% endform %}
  engine.registerTag('form', {
    parse(token, remain) {
      this.args = token.args;
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remain)
        .on('tag:endform', function () { this.stop(); })
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error('{% form %} not closed'); });
      stream.start();
    },
    * render(ctx, emitter) {
      const raw = String(this.args || '');
      const kind = (raw.match(/['"]([^'"]+)['"]/) || [])[1] || '';
      // The theme passes id, class and data-* as named args. Dropping them
      // makes document.forms[id] miss, so the variant picker builds a second
      // hidden form and the visible Add to cart button submits a stale id.
      const attrs = [];
      const named = /([A-Za-z_][\w:-]*)\s*:\s*([^,]+)/g;
      let match;
      while ((match = named.exec(raw))) {
        const name = match[1];
        const allowed = name === 'id' || name === 'class' || name === 'novalidate'
          || name.startsWith('data-') || name.startsWith('aria-');
        if (!allowed) continue;
        let value;
        try { value = this.liquid.evalValueSync(match[2].trim(), ctx); }
        catch { continue; }
        if (value == null || typeof value === 'object') continue;
        const safe = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        attrs.push(`${name}="${safe}"`);
      }
      const routes = (ctx.globals && ctx.globals.routes) || {};
      const root = routes.root || '/api/theme-preview/';
      // Product forms stay on the cart endpoint the theme's own JS posts to.
      // Newsletter forms ({% form 'customer' %}) join the same list as the API.
      let action = '/cart/add';
      if (kind === 'customer') action = '/api/subscribe';
      else if (kind === 'contact' || kind === 'new_comment') action = '/api/contact';
      else if (kind === 'product') action = `${root}cart/add.js`;
      else if (kind === 'cart') action = routes.cart_url || `${root}cart`;
      emitter.write(`<form method="post" action="${action}" accept-charset="UTF-8"${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
      if (kind === 'customer') {
        emitter.write('<input type="hidden" name="source" value="newsletter"><input type="hidden" name="formId" value="newsletter">');
      }
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      emitter.write('</form>');
    },
  });

  // {% paginate collection.products by 12 %} - we render everything, no pages.
  engine.registerTag('paginate', {
    parse(token, remain) {
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remain)
        .on('tag:endpaginate', function () { this.stop(); })
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error('{% paginate %} not closed'); });
      stream.start();
    },
    * render(ctx, emitter) {
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    },
  });

  // {% javascript %} / {% stylesheet %} section assets
  for (const name of ['javascript', 'stylesheet']) {
    engine.registerTag(name, {
      parse(token, remain) {
        this.tpls = [];
        const stream = this.liquid.parser.parseStream(remain)
          .on('tag:end' + name, function () { this.stop(); })
          .on('template', (tpl) => this.tpls.push(tpl))
          .on('end', () => { throw new Error('tag not closed'); });
        stream.start();
      },
      * render(ctx, emitter) {
        const wrap = name === 'javascript' ? 'script' : 'style';
        emitter.write('<' + wrap + '>');
        yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write('</' + wrap + '>');
      },
    });
  }

  /**
   * {% sections 'header-group' %} renders a section GROUP: sections/<name>.json
   * lists sections the way a template does. Shopify resolves this itself; here
   * it is read off disk. A group member that throws is skipped, so a broken
   * header costs the header and not the whole page.
   */
  engine.registerTag('sections', {
    parse(token) { this.name = String(token.args || '').trim().replace(/^['"]|['"]$/g, ''); },
    * render(ctx, emitter) {
      const file = path.join(themeRoot, 'sections', this.name + '.json');
      if (!fs.existsSync(file)) return;
      let group;
      try { group = readThemeJson(file); }
      catch { return; }
      const order = group.order || Object.keys(group.sections || {});
      for (const key of order) {
        const sec = (group.sections || {})[key];
        if (!sec || !sec.type) continue;
        // A section group's link_list settings need resolving exactly as a
        // template's do - the header lives in header-group.json, so skipping it
        // here is what leaves the nav empty.
        // ctx.getAll() returns the SCOPE only - engine globals live on
        // ctx.globals and are absent from it, so reading linklists from the
        // scope quietly yields undefined and every menu resolves to null.
        const all = ctx.getAll();
        const linklists = all.linklists || (ctx.globals && ctx.globals.linklists) || {};
        const blogs = all.blogs || (ctx.globals && ctx.globals.blogs) || {};
        const productsByHandle = (ctx.globals && ctx.globals.productsByHandle) || {};
        const pages = all.pages || (ctx.globals && ctx.globals.pages) || {};
        const schema = readSchema(themeRoot, 'sections', sec.type);
        const scope = {
          ...all,
          section: {
            id: key,
            settings: resolveLinkListSettings(schema, sec.settings || {}, linklists, themeRoot, blogs, productsByHandle, pages),
            blocks: blockList(sec.blocks, sec.block_order),
          },
        };
        try {
          // `section` must be a GLOBAL for this render, not just a scope entry:
          // the header calls {% render 'menu_blocks' %} with no arguments and
          // the snippet reads section.settings.main_menu. {% render %} isolates
          // scope, so without this the snippet sees no section, the menu guard
          // fails, and the nav renders as nothing at all - silently.
          const sectionGlobals = { ...(ctx.globals || {}), ...all, section: scope.section };
          emitter.write(
            wrapSection(key, sec.type,
              yield renderThemeFile(engine, themeRoot, 'sections', sec.type, scope, sectionGlobals)),
          );
        } catch (err) {
          console.warn('[theme] group section "' + key + '" (' + sec.type + ') failed: '
            + String(err.message).split(String.fromCharCode(10))[0]);
        }
      }
    },
  });

  return engine;
}

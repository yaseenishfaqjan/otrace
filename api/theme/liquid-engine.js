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
export async function renderThemeFile(engine, themeRoot, dir, name, scope, globals) {
  const overridden = path.join(themeRoot, '..', 'theme-overrides', `${name}.liquid`);
  const file = fs.existsSync(overridden) ? overridden : path.join(themeRoot, dir, `${name}.liquid`);
  if (!fs.existsSync(file)) throw new Error(`theme file not found: ${dir}/${name}.liquid`);
  // `globals` overrides the engine's own per RENDER, which is how a page sets
  // request.page_type without mutating state the next request also reads.
  return engine.parseAndRender(fs.readFileSync(file, 'utf8'), scope, globals ? { globals } : undefined);
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
export function resolveLinkListSettings(schema, settings, linklists) {
  if (!schema || !settings) return settings;
  const out = { ...settings };
  for (const setting of schema.settings ?? []) {
    if (setting?.type !== 'link_list' || !setting.id) continue;
    const handle = out[setting.id];
    if (typeof handle === 'string') out[setting.id] = linklists?.[handle] ?? null;
  }
  return out;
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

  engine.registerFilter('money', money);
  engine.registerFilter('money_with_currency', (c) => money(c) + ' USD');
  engine.registerFilter('money_without_currency', (c) => (Number(c) / 100).toFixed(2));
  engine.registerFilter('money_without_trailing_zeros', (c) => money(c).replace('.00', ''));

  engine.registerFilter('asset_url', (file) => `${assetBase}/${String(file).replace(/^\/+/, '')}`);
  engine.registerFilter('asset_img_url', (file) => `${assetBase}/${file}`);
  engine.registerFilter('file_url', (file) => `${assetBase}/${file}`);
  engine.registerFilter('shopify_asset_url', (file) => `${assetBase}/${file}`);

  // image_url takes named args (width:, height:) in Shopify; ours are already sized.
  engine.registerFilter('image_url', (src) =>
    typeof src === 'string' ? src : (src && (src.src || src.url)) || '');
  engine.registerFilter('img_url', (src) =>
    typeof src === 'string' ? src : (src && (src.src || src.url)) || '');
  engine.registerFilter('image_tag', (src, ...rest) => `<img src="${src}" ${rest.join(' ')}>`);

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

  // {% content_for 'blocks' %} renders a section's theme-editor blocks. We have
  // no editor, so it renders the blocks the template JSON declares.
  engine.registerTag('content_for', {
    parse(token) { this.what = token.args; },
    * render(ctx, emitter) {
      const section = ctx.get(['section']);
      const blocks = (section && section.blocks) || [];
      for (const block of blocks) {
        const type = block && block.type;
        if (!type) continue;
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
            section: { ...(section || {}), blocks: block.blocks ? Object.values(block.blocks) : [] },
          };
          emitter.write(yield renderThemeFile(engine, themeRoot, 'blocks', type, childScope));
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
      emitter.write('<form method="post" action="/cart/add">');
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
        const schema = readSchema(themeRoot, 'sections', sec.type);
        const scope = {
          ...all,
          section: {
            id: key,
            settings: resolveLinkListSettings(schema, sec.settings || {}, linklists),
            blocks: Object.values(sec.blocks || {}),
          },
        };
        try {
          // `section` must be a GLOBAL for this render, not just a scope entry:
          // the header calls {% render 'menu_blocks' %} with no arguments and
          // the snippet reads section.settings.main_menu. {% render %} isolates
          // scope, so without this the snippet sees no section, the menu guard
          // fails, and the nav renders as nothing at all - silently.
          const sectionGlobals = { ...(ctx.globals || {}), ...all, section: scope.section };
          emitter.write(yield renderThemeFile(engine, themeRoot, 'sections', sec.type, scope, sectionGlobals));
        } catch (err) {
          console.warn('[theme] group section "' + key + '" (' + sec.type + ') failed: '
            + String(err.message).split(String.fromCharCode(10))[0]);
        }
      }
    },
  });

  return engine;
}

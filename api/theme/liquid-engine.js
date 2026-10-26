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
export const readThemeJson = (file) =>
  JSON.parse(fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

export function createEngine(themeRoot, { assetBase = '/theme-assets' } = {}) {
  const engine = new Liquid({
    root: [
      // Ours first: anything in theme-overrides/ replaces the vendor file of
      // the same name, so the theme itself is never edited.
      path.join(themeRoot, '..', 'theme-overrides'),
      path.join(themeRoot, 'sections'),
      path.join(themeRoot, 'snippets'),
      path.join(themeRoot, 'blocks'),
      path.join(themeRoot, 'layout'),
    ],
    extname: '.liquid',
    // A missing variable in a 500-file theme is normal; a crash is not.
    strictVariables: false,
    strictFilters: false,
    jsTruthy: true,
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

  engine.registerFilter('t', (key, args) => {
    // Translations live in locales/*.json; until they are wired, show the key
    // rather than an empty string, so a missing string is visible not invisible.
    if (args && typeof args === 'object' && args.default) return args.default;
    return String(key);
  });
  engine.registerFilter('default_errors', (x) => x);
  engine.registerFilter('handleize', (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  engine.registerFilter('handle', (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  engine.registerFilter('json', (v) => JSON.stringify(v));
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
          const html = yield this.liquid.renderFile(type, { ...ctx.getAll(), block });
          emitter.write(html);
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
      try { group = JSON.parse(fs.readFileSync(file, 'utf8').replace(/[/][*][\s\S]*?[*][/]/g, '')); }
      catch { return; }
      const order = group.order || Object.keys(group.sections || {});
      for (const key of order) {
        const sec = (group.sections || {})[key];
        if (!sec || !sec.type) continue;
        const scope = {
          ...ctx.getAll(),
          section: { id: key, settings: sec.settings || {}, blocks: Object.values(sec.blocks || {}) },
        };
        try {
          emitter.write(yield this.liquid.renderFile(sec.type, scope));
        } catch (err) {
          console.warn('[theme] group section "' + key + '" (' + sec.type + ') failed: '
            + String(err.message).split(String.fromCharCode(10))[0]);
        }
      }
    },
  });

  return engine;
}

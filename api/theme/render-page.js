/**
 * A whole Kalles page, rendered from the theme's own files.
 *
 * Shopify assembles a page as: templates/<name>.json lists sections in order,
 * each section renders, and the result is dropped into layout/theme.liquid as
 * `content_for_layout`. This does the same thing, with our catalogue standing
 * in for Shopify's.
 *
 * One section failing must not blank the page: a section that throws is logged
 * and skipped, so a missing block costs a strip of the page rather than the
 * whole shop. The log names the section, which is how the remaining gaps get
 * found.
 */
import path from 'node:path';
import {
  createEngine,
  readSchema,
  readThemeJson,
  renderThemeFile,
  blockList,
  resolveLinkListSettings,
  wrapSection,
} from './liquid-engine.js';
import { toShopifyProduct, themeSettings } from './shopify-shape.js';

export function createThemeRenderer({
  themeRoot,
  siteUrl = '',
  assetBase = '/theme-assets',
  routesRoot = '/',
}) {
  const settings = themeSettings(
    readThemeJson(path.join(themeRoot, 'config', 'settings_data.json')),
    readThemeJson(path.join(themeRoot, 'config', 'settings_schema.json')),
  );

  /**
   * The objects Shopify treats as GLOBAL.
   *
   * These must reach the engine as globals, not merely sit in the render scope:
   * {% render %} isolates scope, so a snippet given only a scope sees none of
   * them and prints an empty string for every one - which is how an inline
   * <script> full of theme globals becomes a syntax error.
   */
  const SHOP = {
    name: 'OTRACE',
    url: siteUrl,
    description: 'Heavyweight oversized hoodies and wide-leg sweatpants.',
    currency: 'USD',
    money_format: '${{amount}}',
    money_with_currency_format: '${{amount}} USD',
    email: 'info@otrace.co',
    permanent_domain: 'otrace.co',
  };
  const ROUTES = {
    root: routesRoot, cart_url: `${routesRoot}cart`, cart_add_url: `${routesRoot}cart/add`,
    cart_change_url: '/cart/change', cart_update_url: '/cart/update',
    search_url: '/search', predictive_search_url: '/search/suggest',
    all_products_collection_url: '/shop', account_url: '/account',
  };
  const REQUEST = { locale: { iso_code: 'en' }, origin: siteUrl, design_mode: false, page_type: 'index' };
  const CART = { items: [], item_count: 0, total_price: 0, original_total_price: 0, currency: { iso_code: 'USD' } };

  /**
   * Navigation.
   *
   * The theme reads menus as `linklists[<handle>]`, with the handle coming from
   * a section setting ("main-menu" in header-group.json). An unknown handle is
   * not an error - the header just prints "Please add main menu in header
   * section", so a typo here looks like a missing menu rather than a bad key.
   */
  const link = (title, url, links = []) => ({
    title, url, links, active: false, child_active: false, levels: links.length ? 1 : 0,
    type: 'http_link', object: null,
  });
  const LINKLISTS = {
    'main-menu': {
      title: 'Main menu',
      handle: 'main-menu',
      links: [
        link('Shop', '/shop', [link('Hoodies', '/shop/hoodies'), link('Bottoms', '/shop/bottoms')]),
        link('Lookbook', '/lookbook'),
        link('Garment dyed', '/garment-dyed'),
        link('Sizing', '/sizing'),
        link('Contact', '/contact'),
      ],
    },
    footer: {
      title: 'Footer',
      handle: 'footer',
      links: [link('Shipping', '/shipping'), link('Sizing', '/sizing'), link('Contact', '/contact'), link('Privacy', '/privacy')],
    },
  };

  const GLOBALS = {
    settings,
    shop: SHOP,
    routes: ROUTES,
    request: REQUEST,
    cart: CART,
    linklists: LINKLISTS,
    localization: { available_countries: [], available_languages: [] },
    powered_by_link: '',
  };

  const engine = createEngine(themeRoot, { assetBase, globals: GLOBALS });

  /**
   * LiquidJS's per-render `globals` REPLACES the engine's rather than merging
   * with them, so a call that overrides one key silently drops `settings`,
   * `shop` and the rest - and the only symptom is empty values in an inline
   * script hundreds of lines away. Always build the override from GLOBALS.
   */
  const withGlobals = (overrides) => ({ ...GLOBALS, ...overrides });

  const baseScope = () => ({
    settings,
    shop: SHOP,
    routes: ROUTES,
    request: REQUEST,
    cart: CART,
    linklists: LINKLISTS,
    localization: { available_countries: [], available_languages: [] },
    canonical_url: siteUrl,
    powered_by_link: '',
  });

  /** Render every section a template lists, in order. */
  async function renderTemplate(templateName, extra, globals) {
    const tpl = readThemeJson(path.join(themeRoot, 'templates', `${templateName}.json`));
    const order = tpl.order ?? Object.keys(tpl.sections ?? {});
    const out = [];
    for (const key of order) {
      const sec = tpl.sections?.[key];
      if (!sec?.type) continue;
      const schema = readSchema(themeRoot, 'sections', sec.type);
      const scope = {
        ...baseScope(),
        ...extra,
        section: {
          id: key,
          settings: resolveLinkListSettings(schema, sec.settings ?? {}, LINKLISTS),
          blocks: blockList(sec.blocks),
        },
      };
      try {
        out.push(
          wrapSection(
            key,
            sec.type,
            await renderThemeFile(engine, themeRoot, 'sections', sec.type, scope, {
              ...withGlobals(globals),
              section: scope.section,
            }),
          ),
        );
      } catch (err) {
        console.warn(`[theme] section "${key}" (${sec.type}) failed: ${String(err.message).split('\n')[0]}`);
      }
    }
    return out.join('\n');
  }

  async function renderProduct(product) {
    const shaped = toShopifyProduct(product, { siteUrl });
    const url = `${siteUrl}/product/${shaped.handle}`;
    // Snippets read `request.page_type` and `product` through {% render %},
    // which sees globals only - so both belong here, not just in the scope.
    const globals = withGlobals({
      request: { ...REQUEST, page_type: 'product' },
      product: shaped,
      template: { name: 'product', suffix: null },
    });
    const content = await renderTemplate('product', {
      product: shaped,
      request: globals.request,
      template: globals.template,
      collection: null,
      canonical_url: url,
    }, globals);
    return wrap(content, {
      product: shaped,
      request: globals.request,
      template: globals.template,
      page_title: `${shaped.title} — OTRACE`,
      page_description: shaped.description,
      canonical_url: url,
    }, globals);
  }

  /**
   * Render any template by name - cart, index, collection, a page.
   *
   * `extra` becomes BOTH scope and globals: a template's sections reach their
   * snippets through {% render %}, which sees globals only, so passing `cart`
   * as scope alone leaves the cart page rendering an empty basket.
   */
  async function renderPage(templateName, extra = {}, pageType = templateName) {
    // The heading block prints page.title, and the <title> element prints
    // page_title. They are not the same string: putting the document title in
    // the heading puts " - OTRACE" in the middle of the page.
    const title = extra.title ?? 'OTRACE';
    const globals = withGlobals({
      ...extra,
      request: { ...REQUEST, page_type: pageType },
      template: { name: templateName, suffix: null },
      // Templates print {{ page.title }} as their heading. With no `page` the
      // heading renders the literal braces, which reads as a broken page.
      page: { title, handle: templateName, content: '', url: `/${templateName}` },
      // The heading block's own default is {{ page_title }}, not page.title.
      page_title: title,
    });
    const content = await renderTemplate(templateName, { ...baseScope(), ...globals }, globals);
    return wrap(content, { ...globals, page_title: extra.page_title ?? title }, globals);
  }

  /** Drop the sections into layout/theme.liquid. */
  /**
   * What Shopify injects into {{ content_for_header }}.
   *
   * The theme's custom elements read `Shopify.routes`, `Shopify.locale` and
   * `Shopify.designMode` inside connectedCallback, so on a non-Shopify host
   * every one of them throws "Shopify is not defined" the moment it upgrades -
   * which silently kills the gallery, the cart drawer and the sticky header
   * while the HTML and CSS look perfectly fine.
   */
  const contentForHeader = () =>
    '<script>window.Shopify = window.Shopify || ' +
    JSON.stringify({
      shop: 'otrace.co',
      locale: 'en',
      currency: { active: 'USD', rate: '1.0' },
      country: 'US',
      theme: { name: 'Kalles', id: 1, role: 'main' },
      designMode: false,
      // Every AJAX URL the theme builds is `${Shopify.routes.root}cart/add.js`
      // and friends, so this one value decides where its cart, product and
      // search requests land.
      routes: { root: routesRoot },
    }) +
    ';<\/script>';

  async function wrap(contentForLayout, extra, globals) {
    const scope = { ...baseScope(), ...extra, content_for_layout: contentForLayout,
      content_for_header: contentForHeader(), content_for_index: '' };
    return renderThemeFile(engine, themeRoot, 'layout', 'theme', scope, globals);
  }

  return { engine, renderTemplate, renderProduct, renderPage, wrap, settings };
}

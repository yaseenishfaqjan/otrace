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
import { createEngine, readThemeJson, renderThemeFile } from './liquid-engine.js';
import { toShopifyProduct, themeSettings } from './shopify-shape.js';

export function createThemeRenderer({ themeRoot, siteUrl = '', assetBase = '/theme-assets' }) {
  const engine = createEngine(themeRoot, { assetBase });
  const settings = themeSettings(readThemeJson(path.join(themeRoot, 'config', 'settings_data.json')));

  const baseScope = () => ({
    settings,
    shop: {
      name: 'OTRACE',
      url: siteUrl,
      description: 'Heavyweight oversized hoodies and wide-leg sweatpants.',
      money_format: '${{amount}}',
      email: 'info@otrace.co',
    },
    routes: {
      root: '/', cart_url: '/cart', cart_add_url: '/cart/add',
      cart_change_url: '/cart/change', cart_update_url: '/cart/update',
      search_url: '/search', predictive_search_url: '/search/suggest',
      all_products_collection_url: '/shop', account_url: '/account',
    },
    request: { locale: { iso_code: 'en' }, origin: siteUrl, design_mode: false },
    cart: { items: [], item_count: 0, total_price: 0, original_total_price: 0, currency: { iso_code: 'USD' } },
    linklists: {},
    localization: { available_countries: [], available_languages: [] },
    canonical_url: siteUrl,
    powered_by_link: '',
  });

  /** Render every section a template lists, in order. */
  async function renderTemplate(templateName, extra) {
    const tpl = readThemeJson(path.join(themeRoot, 'templates', `${templateName}.json`));
    const order = tpl.order ?? Object.keys(tpl.sections ?? {});
    const out = [];
    for (const key of order) {
      const sec = tpl.sections?.[key];
      if (!sec?.type) continue;
      const scope = {
        ...baseScope(),
        ...extra,
        section: { id: key, settings: sec.settings ?? {}, blocks: Object.values(sec.blocks ?? {}) },
      };
      try {
        out.push(await renderThemeFile(engine, themeRoot, 'sections', sec.type, scope));
      } catch (err) {
        console.warn(`[theme] section "${key}" (${sec.type}) failed: ${String(err.message).split('\n')[0]}`);
      }
    }
    return out.join('\n');
  }

  async function renderProduct(product) {
    const shaped = toShopifyProduct(product, { siteUrl });
    const content = await renderTemplate('product', {
      product: shaped,
      template: { name: 'product', suffix: null },
      collection: null,
      canonical_url: `${siteUrl}/product/${shaped.handle}`,
    });
    return wrap(content, {
      product: shaped,
      template: { name: 'product' },
      page_title: `${shaped.title} — OTRACE`,
      page_description: shaped.description,
      canonical_url: `${siteUrl}/product/${shaped.handle}`,
    });
  }

  /** Drop the sections into layout/theme.liquid. */
  async function wrap(contentForLayout, extra) {
    const scope = { ...baseScope(), ...extra, content_for_layout: contentForLayout,
      content_for_header: '', content_for_index: '' };
    return renderThemeFile(engine, themeRoot, 'layout', 'theme', scope);
  }

  return { engine, renderTemplate, renderProduct, wrap, settings };
}

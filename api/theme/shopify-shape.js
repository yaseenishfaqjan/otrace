/**
 * Our catalogue, in the shape Shopify's Liquid expects.
 *
 * The theme reads `product.variants`, `product.options_with_values`,
 * `product.selected_or_first_available_variant` and so on. None of that exists
 * in our catalogue, which stores sizes and colours as flat arrays, so this
 * builds the cartesian product of size x colour into variants the way Shopify
 * would. Prices are in cents, as Shopify Liquid expects, and come from
 * api/catalog.js - the one place that decides what anything costs.
 */
const handleize = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Option values have to be string-like AND carry `.available`.
 *
 * A plain string has no `.available`, so the variant picker treats every size
 * and colour as sold out and adds `is-unavailable` plus "Variant sold out".
 * `new String` prints as the label and still holds the flag.
 */
function optionValue(label) {
  const value = new String(label);
  value.available = true;
  value.variant = { available: true };
  return value;
}

export function toShopifyProduct(p, { siteUrl = '' } = {}) {
  const colours = p.colours ?? ['Default'];
  const sizes = p.sizes ?? ['One Size'];
  const abs = (src) => (String(src).startsWith('http') ? src : siteUrl + src);

  const variants = [];
  for (const colour of colours) {
    for (const size of sizes) {
      variants.push({
        id: `${p.sku}-${handleize(colour)}-${handleize(size)}`,
        title: `${colour} / ${size}`,
        option1: colour,
        option2: size,
        options: [colour, size],
        price: p.priceCents,
        compare_at_price: p.listPriceCents > p.priceCents ? p.listPriceCents : null,
        available: true,
        inventory_management: null,
        inventory_policy: 'continue',
        quantity_rule: { min: 1, max: null, increment: 1 },
        sku: `${p.sku}-${size}`,
        featured_image: null,
        requires_shipping: true,
      });
    }
  }

  /**
   * A Shopify image is an OBJECT, not a URL string.
   *
   * The theme sizes every media slot from `width`/`height` (and the
   * `aspect_ratio` derived from them), so an image carrying only a src renders
   * at height ZERO - in the DOM, fetched over the network, and invisible. That
   * failure shows up as "the gallery is blank" with no error anywhere.
   */
  const images = (p.images ?? []).map((i, index) => {
    const src = abs(i.src ?? i);
    const width = i.width ?? 1000;
    const height = i.height ?? 1000;
    return {
      id: index + 1,
      src,
      // Liquid calls .src on an image, but also prints the image itself in
      // places; toString keeps both working.
      toString: () => src,
      alt: i.alt ?? p.name ?? '',
      width,
      height,
      aspect_ratio: width / height,
      position: index + 1,
      attached_to_variant: false,
      variants: [],
    };
  });

  const media = images.map((image, i) => ({
    id: i + 1,
    media_type: 'image',
    position: i + 1,
    alt: image.alt,
    src: image.src,
    width: image.width,
    height: image.height,
    aspect_ratio: image.aspect_ratio,
    preview_image: image,
  }));

  return {
    id: p.sku,
    handle: p.slug,
    title: p.name,
    vendor: 'OTRACE',
    type: p.category ?? 'Apparel',
    url: `/product/${p.slug}`,
    description: p.description ?? '',
    content: p.description ?? '',
    price: p.priceCents,
    price_min: p.priceCents,
    price_max: p.priceCents,
    compare_at_price: p.listPriceCents > p.priceCents ? p.listPriceCents : null,
    compare_at_price_min: p.listPriceCents > p.priceCents ? p.listPriceCents : null,
    available: true,
    tags: [],
    featured_image: images[0] ?? null,
    images,
    media,
    // Product CARDS read featured_media, not featured_image. With only the
    // latter the card falls through to the placeholder: the grid renders at
    // full size with every tile empty, and nothing reports a problem.
    featured_media: media[0] ?? null,
    options: ['Color', 'Size'],
    options_with_values: [
      { name: 'Color', position: 1, values: colours.map(optionValue) },
      { name: 'Size', position: 2, values: sizes.map(optionValue) },
    ],
    variants,
    first_available_variant: variants[0],
    selected_or_first_available_variant: variants[0],
    selected_variant: null,
    has_only_default_variant: false,
    metafields: {},
  };
}

/** The theme reads hundreds of `settings.*`; they ship in the theme itself. */
/**
 * A Shopify collection over our own catalogue.
 *
 * The listing templates read products, counts and the handle; `paginate` is
 * satisfied by the engine's own tag, so there is no page state to model while
 * the catalogue is two products.
 */
export function toShopifyCollection({ handle, title, description = '', products }, { siteUrl = '' } = {}) {
  const shaped = products.map((p) => toShopifyProduct(p, { siteUrl }));
  return {
    id: handle,
    handle,
    title,
    name: title,
    description,
    url: `/collections/${handle}`,
    products: shaped,
    all_products_count: shaped.length,
    products_count: shaped.length,
    all_tags: [],
    tags: [],
    sort_by: null,
    default_sort_by: 'manual',
    featured_image: shaped[0]?.featured_image ?? null,
    image: shaped[0]?.featured_image ?? null,
    filters: [],
  };
}

export function themeSettings(settingsData, settingsSchema) {
  const current = settingsData?.current ?? settingsData ?? {};
  const saved = typeof current === 'object' ? current : {};

  // settings_data.json only stores what was CHANGED from the default. A key it
  // omits renders as an empty string, and `{{ settings.auto_currency }}` with no
  // value turns the inline script that reads it into a syntax error - which
  // takes out every global defined in that block, not just the one setting.
  // The schema is where the defaults live, so read them from it.
  const defaults = {};
  for (const group of Array.isArray(settingsSchema) ? settingsSchema : []) {
    for (const setting of group?.settings ?? []) {
      if (!setting?.id) continue;
      if ('default' in setting) defaults[setting.id] = setting.default;
      // Same rule as block settings: a select with no default takes its first
      // option rather than rendering as an empty string.
      else if ((setting.type === 'select' || setting.type === 'radio') && setting.options?.length) {
        defaults[setting.id] = setting.options[0].value;
      }
    }
  }
  return { ...defaults, ...saved };
}

/**
 * Theme settings that point at products.
 *
 * A `product_list` saved in the theme editor is a list of handles. Left as
 * strings, the search drawer treats each one as a product: the title and the
 * link are empty, and price.liquid's `default: 1999` prints the $19.99
 * placeholder. Unknown handles are dropped. An empty list becomes null,
 * because LiquidJS treats [] as truthy and would still enter the suggestion
 * branch.
 */
export function resolveThemeProductSettings(settings, settingsSchema, productsByHandle) {
  if (!settings) return settings;
  const lookup = (handle) => {
    if (handle && typeof handle === 'object' && handle.title) return handle;
    if (typeof handle !== 'string' || !handle) return null;
    const product = productsByHandle?.[handle];
    return product?.title ? product : null;
  };
  for (const group of Array.isArray(settingsSchema) ? settingsSchema : []) {
    for (const setting of group?.settings ?? []) {
      if (!setting?.id) continue;
      if (setting.type === 'product_list' && Array.isArray(settings[setting.id])) {
        const resolved = settings[setting.id].map(lookup).filter(Boolean);
        settings[setting.id] = resolved.length ? resolved : null;
      } else if (setting.type === 'product' && typeof settings[setting.id] === 'string') {
        settings[setting.id] = lookup(settings[setting.id]);
      }
    }
  }
  return settings;
}

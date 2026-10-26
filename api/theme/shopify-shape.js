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
        sku: `${p.sku}-${size}`,
        featured_image: null,
        requires_shipping: true,
      });
    }
  }

  const images = (p.images ?? []).map((i) => abs(i.src ?? i));

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
    compare_at_price_min: p.listPriceCents ?? p.priceCents,
    available: true,
    tags: [],
    featured_image: images[0] ?? null,
    images,
    media: images.map((src, i) => ({ id: i, media_type: 'image', src, preview_image: { src } })),
    options: ['Color', 'Size'],
    options_with_values: [
      { name: 'Color', position: 1, values: colours },
      { name: 'Size', position: 2, values: sizes },
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
export function themeSettings(settingsData) {
  const current = settingsData?.current ?? settingsData ?? {};
  return typeof current === 'object' ? current : {};
}

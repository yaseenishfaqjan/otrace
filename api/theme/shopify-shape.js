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
import { Drop } from 'liquidjs';
import { productDisplayName } from '../catalog.js';
import { applyThemeColorAndFont, swatchFor } from './shopify-color.js';

const handleize = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Option values have to print as the label, compare equal to that label, and
 * still carry `.available` and `.swatch`.
 *
 * A plain string has no `.available`, so the picker marks every size sold out.
 * `new String` keeps the flag but LiquidJS `==` does not treat it as the
 * label, so the selected colour and size never render `checked`. The picker
 * then ignores a size click until the colour is clicked too, and Add to cart
 * keeps submitting the first variant.
 */
class OptionValue extends Drop {
  constructor(label) {
    super();
    this.label = String(label);
    this.available = true;
    this.variant = { available: true };
    const swatch = swatchFor(label);
    if (swatch) this.swatch = swatch;
  }

  *equals(value) {
    const other = value && typeof value === 'object' && value.label ? value.label : value;
    return String(other ?? '') === this.label;
  }

  valueOf() { return this.label; }
  toString() { return this.label; }
}

function optionValue(label) {
  return new OptionValue(label);
}

/**
 * Colourways in option order, each with the shots that belong to it.
 *
 * A shop card passes one colour and the full `colorways` list still hangs off
 * the product. Filtering by `colours` keeps that card on one colour. A product
 * with no colourway list falls back to the flat image array.
 */
function sourceColorways(p, colours) {
  const listed = Array.isArray(p.colorways) ? p.colorways : [];
  const matched = colours
    .map((name) => listed.find((c) => c?.name === name && Array.isArray(c.images) && c.images.length))
    .filter(Boolean);
  if (matched.length) return matched;
  return [{ name: colours[0], images: p.images ?? [] }];
}

/**
 * Product-page order: the marked shot first, then the rest as filed.
 *
 * Shop cards leave this off so the logo flat stays the card and the back
 * stays the hover frame. `featured` is a file we already have, never a resize.
 */
function shotsInOrder(colorway, featureSharpest) {
  const shots = [...(colorway.images ?? [])];
  if (!featureSharpest) return shots;
  const lead = shots.findIndex((shot) => shot?.featured);
  if (lead <= 0) return shots;
  return [shots[lead], ...shots.slice(0, lead), ...shots.slice(lead + 1)];
}

export function toShopifyProduct(p, { siteUrl = '', featureSharpest = false } = {}) {
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
        featured_media: null,
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
   *
   * Variants used to leave `featured_image` null. Kalles reads
   * `variant.featured_media.id` into `data-mdid` and only then slides the
   * gallery, and it only filters thumbnails when `group_media_obj` names the
   * colour option. With neither set, the swatch updates the label and the
   * URL and the main photo stays wherever the strip was last scrolled.
   */
  const images = [];
  const media = [];
  const imagesByColour = new Map();
  const leadByColour = new Map();
  const groupMedia = [];
  let nextId = 1;

  for (const colorway of sourceColorways(p, colours)) {
    const colourIndex = colours.indexOf(colorway.name);
    const shots = shotsInOrder(colorway, featureSharpest);
    const colourImages = [];
    shots.forEach((raw, shotIndex) => {
      const src = abs(raw.src ?? raw);
      const width = raw.width ?? 1000;
      const height = raw.height ?? 1000;
      const id = nextId++;
      const image = {
        id,
        src,
        // Liquid calls .src on an image, but also prints the image itself in
        // places; toString keeps both working.
        toString: () => src,
        alt: raw.alt ?? p.name ?? '',
        width,
        height,
        aspect_ratio: width / height,
        position: id,
        attached_to_variant: false,
        // The gallery asks for this exact property name, question mark included.
        'attached_to_variant?': false,
        variants: [],
        colour: colorway.name,
      };
      const item = {
        id,
        media_type: 'image',
        position: id,
        alt: image.alt,
        src,
        width,
        height,
        aspect_ratio: image.aspect_ratio,
        preview_image: image,
        colour: colorway.name,
      };
      images.push(image);
      media.push(item);
      colourImages.push(image);
      if (shotIndex === 0) leadByColour.set(colorway.name, { image, media: item });
      // media.liquid only groups a frame when `media_group.size > 0`. Shopify
      // hashes report .size; a plain object does not, so the count is stored.
      groupMedia.push({ mid: id, option: 0, value: colourIndex, size: 3 });
    });
    imagesByColour.set(colorway.name, colourImages);
  }

  for (const variant of variants) {
    const lead = leadByColour.get(variant.option1);
    const colourImages = imagesByColour.get(variant.option1) ?? [];
    if (!lead) continue;
    variant.featured_image = lead.image;
    variant.featured_media = lead.media;
    for (const image of colourImages) {
      image.attached_to_variant = true;
      image['attached_to_variant?'] = true;
      image.variants.push({ id: variant.id });
    }
  }

  return {
    id: p.sku,
    handle: p.slug,
    title: productDisplayName(p),
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
    metafields: {
      theme: {
        // Kalles filters the strip with product.metafields.theme.group_media_obj.value.
        // option 0 is Color. value is the index in options_with_values.
        group_media_obj: { value: groupMedia },
      },
    },
  };
}

/**
 * Honour `?variant=` on the product page.
 *
 * The picker writes the URL from the variant the SERVER rendered, then never
 * reads the query back. A shared warm-cream link otherwise paints Onyx Black
 * and the script replaces the URL with that variant on connect.
 */
export function selectShopifyVariant(shaped, variantId) {
  if (!shaped?.variants?.length || variantId == null || String(variantId).trim() === '') return shaped;
  const wanted = String(variantId).trim().toLowerCase();
  const found = shaped.variants.find((variant) => String(variant.id).toLowerCase() === wanted);
  if (!found) return shaped;
  shaped.selected_variant = found;
  shaped.selected_or_first_available_variant = found;
  shaped.first_available_variant = found;
  if (found.featured_media) shaped.featured_media = found.featured_media;
  if (found.featured_image) shaped.featured_image = found.featured_image;
  const colour = found.option1;
  const rank = (item) => (item?.colour === colour ? 0 : 1);
  shaped.media.sort((a, b) => rank(a) - rank(b));
  shaped.images.sort((a, b) => rank(a) - rank(b));
  shaped.media.forEach((item, index) => {
    item.position = index + 1;
    if (item.preview_image) item.preview_image.position = index + 1;
  });
  return shaped;
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
  return applyThemeColorAndFont({ ...defaults, ...saved });
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

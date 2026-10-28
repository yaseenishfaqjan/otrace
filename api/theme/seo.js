/**
 * Head tags the React storefront wrote at prerender time: robots, Open Graph,
 * describedby / markdown alternates, and JSON-LD. The theme layout already
 * prints the title, the description and the canonical URL.
 */
import { PRODUCTS, SET_LIST_CENTS, SET_TOTAL_CENTS, SHIP_COUNTRIES, formatMoney, productDisplayName } from '../catalog.js';
import { POSTS, journalBlurb } from '../../site/src/content/posts.mjs';

export const ENTITY_SUMMARY =
  'OTRACE sells a 450 GSM garment-dyed Oversized Hoodie and a Wide-Leg Sweatpant in Onyx Black and Warm Cream, and ships worldwide, with free delivery in the United States.';

export const DEFAULT_DESCRIPTION =
  'OTRACE AW2026: 450 GSM heavyweight fleece hoodies and wide-leg sweatpants, cut oversized and garment dyed in Onyx Black and Warm Cream. In stock, free US shipping.';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const originOf = (siteUrl) => String(siteUrl || 'https://otrace.co').replace(/\/$/, '');

export const MARKDOWN_BY_PATH = {
  '/': '/index.md',
  '/about': '/about.md',
  '/sizing': '/sizing.md',
  '/garment-dyed': '/garment-dyed.md',
  '/shipping': '/shipping.md',
  '/faq': '/faq.md',
  '/product/oversized-hoodie': '/product/oversized-hoodie.md',
  '/product/wide-leg-sweatpant': '/product/wide-leg-sweatpant.md',
  '/product/complete-set': '/product/complete-set.md',
  '/blog': '/blog/index.md',
};

export const FACT_SELECTOR = '.otrace-fact';
export const FABRIC = '450 GSM garment-dyed heavyweight cotton fleece';

for (const post of POSTS) MARKDOWN_BY_PATH[`/blog/${post.slug}`] = `/blog/${post.slug}.md`;

/**
 * Free delivery is published for United States addresses only.
 * The second node says the shop ships to the other checkout countries and
 * does not carry a rate, so it cannot be read as free shipping outside the US.
 * Handling time is the published 3–5 business days to dispatch, not transit.
 */
function offerShippingDetails() {
  return [
    {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 3,
          maxValue: 5,
          unitCode: 'DAY',
          unitText: 'business days',
        },
      },
    },
    {
      '@type': 'OfferShippingDetails',
      name: 'Worldwide shipping',
      description: 'Ships worldwide to the address entered at checkout. Free delivery is for United States addresses only.',
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: SHIP_COUNTRIES.filter((code) => code !== 'US'),
      },
    },
  ];
}

/** Unworn, tags on, 30 days, by mail. The returns answer says we send a label. */
function offerReturnPolicy(siteUrl) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: SHIP_COUNTRIES,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 30,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
    refundType: ['https://schema.org/FullRefund', 'https://schema.org/ExchangeRefund'],
    itemCondition: 'https://schema.org/NewCondition',
    merchantReturnLink: `${originOf(siteUrl)}/shipping`,
  };
}

function offerPolicy(siteUrl) {
  return {
    shippingDetails: offerShippingDetails(),
    hasMerchantReturnPolicy: offerReturnPolicy(siteUrl),
  };
}

export function organizationLd(siteUrl) {
  const origin = originOf(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'OTRACE',
    url: origin,
    description: ENTITY_SUMMARY,
    email: 'info@otrace.co',
    logo: `${origin}/icon-512.png`,
    sameAs: [],
  };
}

export function websiteLd(siteUrl) {
  const origin = originOf(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'OTRACE',
    url: origin,
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': `${origin}/#organization` },
  };
}

export function breadcrumbLd(siteUrl, items) {
  const origin = originOf(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${origin}${item.path === '/' ? '/' : item.path}`,
    })),
  };
}

/** One WebPage node, only when the HTML actually contains FACT_SELECTOR. */
export function speakableLd(siteUrl, path) {
  const origin = originOf(siteUrl);
  const canonicalPath = path === '/' ? '/' : String(path || '/');
  const url = `${origin}${canonicalPath === '/' ? '/' : canonicalPath}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: [FACT_SELECTOR],
    },
  };
}

/**
 * The gallery leads with the featured shot for the selected colour.
 * That file is the Open Graph image. Home stays on /og.jpg.
 */
export function primaryImagePath(product, color) {
  const colorways = product?.colorways ?? [];
  const raw = String(color || '').trim().toLowerCase();
  const wanted = raw.replace(/-/g, ' ');
  const colorway = colorways.find((item) => {
    const name = String(item?.name || '').toLowerCase();
    return name === wanted || name.replace(/\s+/g, '-') === raw;
  }) || colorways[0];
  const shots = [...(colorway?.images ?? [])];
  const lead = shots.findIndex((shot) => shot?.featured);
  const ordered = lead > 0 ? [shots[lead], ...shots.slice(0, lead), ...shots.slice(lead + 1)] : shots;
  return ordered[0]?.src || product?.image || '/og.jpg';
}

const ONCE_PER_PAGE = new Set(['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage', 'WebPage']);

/** Drop a second copy of the types that must appear once, and keep one Organization. */
export function normalizeJsonLd(siteUrl, jsonLd) {
  const list = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const node of list) {
    const types = [].concat(node['@type'] || []);
    if (types.some((type) => ONCE_PER_PAGE.has(type) && seen.has(type))) continue;
    for (const type of types) if (ONCE_PER_PAGE.has(type)) seen.add(type);
    out.push(node);
  }
  if (!seen.has('Organization')) out.unshift(organizationLd(siteUrl));
  return out;
}

export function faqLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (faqs || []).map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function productLd(product, siteUrl) {
  const origin = originOf(siteUrl);
  const url = `${origin}/product/${product.slug}`;
  const images = [];
  for (const colorway of product.colorways ?? []) {
    for (const image of colorway.images ?? []) {
      if (image?.src) images.push(`${origin}${image.src}`);
    }
  }
  const variants = [];
  for (const colorway of product.colorways ?? []) {
    for (const size of product.sizes ?? []) {
      const color = colorway.name.toLowerCase().replace(/\s+/g, '-');
      variants.push({
        '@type': 'Product',
        sku: `${product.sku}-${color}-${size}`.toUpperCase(),
        name: `${productDisplayName(product)} — ${colorway.name} — ${size}`,
        color: colorway.name,
        size,
        image: (colorway.images ?? []).map((image) => `${origin}${image.src}`),
        offers: {
          '@type': 'Offer',
          url: `${url}?color=${color}`,
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: 'USD',
          availability: product.preorder ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          ...offerPolicy(siteUrl),
        },
      });
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: productDisplayName(product),
    description: product.description,
    url,
    brand: { '@type': 'Brand', name: 'OTRACE' },
    productGroupID: product.sku,
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    material: FABRIC,
    image: images,
    hasVariant: variants,
  };
}

export function setLd(siteUrl) {
  const origin = originOf(siteUrl);
  const url = `${origin}/product/complete-set`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#set`,
    name: 'Complete set',
    description: `One Oversized Hoodie and one Wide-Leg Sweatpant, ${formatMoney(SET_TOTAL_CENTS)} together (was ${formatMoney(SET_LIST_CENTS)}). Each piece alone is ${formatMoney(PRODUCTS['OT-HOOD'].priceCents)}.`,
    url,
    brand: { '@type': 'Brand', name: 'OTRACE' },
    offers: {
      '@type': 'Offer',
      url,
      price: (SET_TOTAL_CENTS / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      ...offerPolicy(siteUrl),
    },
  };
}

export function blogIndexLd(siteUrl) {
  const origin = originOf(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'OTRACE Journal',
    description: journalBlurb,
    url: `${origin}/blog`,
    publisher: { '@id': `${origin}/#organization` },
    blogPost: POSTS.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.h1,
      url: `${origin}/blog/${post.slug}`,
      datePublished: post.date,
    })),
  };
}

export function blogPostLd(post, siteUrl) {
  const origin = originOf(siteUrl);
  const url = `${origin}/blog/${post.slug}`;
  const images = [post.hero, ...post.sections.flatMap((section) => (section.image ? [section.image] : []))];
  return {
    '@context': 'https://schema.org',
    '@type': ['BlogPosting', 'Article'],
    headline: post.h1,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'OTRACE', url: origin },
    publisher: { '@id': `${origin}/#organization` },
    image: images.filter(Boolean).map((image) => `${origin}${image.src}`),
    mainEntityOfPage: url,
    url,
  };
}

export function collectionLd(siteUrl, { name, path, products }) {
  const origin = originOf(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: `${origin}${path}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.map((product, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${origin}/product/${product.slug}`,
        name: productDisplayName(product),
      })),
    },
  };
}

function jsonScript(data) {
  const list = (Array.isArray(data) ? data : [data]).filter(Boolean);
  return list
    .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry).replace(/</g, '\\u003c')}</script>`)
    .join('\n');
}

/**
 * Extra tags for content_for_header. `path` is the public pathname.
 */
export function seoHead({
  siteUrl,
  path = '/',
  title,
  description,
  noindex = false,
  image = '/og.jpg',
  type = 'website',
  jsonLd = null,
}) {
  const origin = originOf(siteUrl);
  const canonicalPath = path === '/' ? '/' : String(path || '/').replace(/\/$/, '');
  const url = `${origin}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const img = String(image).startsWith('http') ? image : `${origin}${image}`;
  const markdown = MARKDOWN_BY_PATH[canonicalPath];
  const robots = noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  const parts = [
    `<meta name="robots" content="${robots}">`,
    `<meta property="og:title" content="${esc(title || 'OTRACE')}">`,
    `<meta property="og:description" content="${esc(description || DEFAULT_DESCRIPTION)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title || 'OTRACE')}">`,
    `<meta name="twitter:description" content="${esc(description || DEFAULT_DESCRIPTION)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<link rel="describedby" href="${origin}/llms.txt">`,
  ];
  if (markdown) {
    parts.push(`<link rel="alternate" type="text/markdown" href="${origin}${markdown}">`);
  }
  parts.push(`<link rel="manifest" href="${origin}/site.webmanifest">`);
  parts.push(jsonScript(normalizeJsonLd(siteUrl, jsonLd)));
  return parts.join('\n');
}

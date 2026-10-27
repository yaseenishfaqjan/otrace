/**
 * Head tags the React storefront wrote at prerender time: robots, Open Graph,
 * describedby / markdown alternates, and JSON-LD. The theme layout already
 * prints the title, the description and the canonical URL.
 */
import { PRODUCTS, SET_LIST_CENTS, SET_TOTAL_CENTS, formatMoney } from '../catalog.js';
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
  '/product/oversized-hoodie': '/product/oversized-hoodie.md',
  '/product/wide-leg-sweatpant': '/product/wide-leg-sweatpant.md',
  '/blog': '/blog/index.md',
};

for (const post of POSTS) MARKDOWN_BY_PATH[`/blog/${post.slug}`] = `/blog/${post.slug}.md`;

const SHIPPING_DETAILS = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
};

const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 30,
  returnMethod: 'https://schema.org/ReturnByMail',
};

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
        name: `${product.name} — ${colorway.name} — ${size}`,
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
          shippingDetails: SHIPPING_DETAILS,
          hasMerchantReturnPolicy: RETURN_POLICY,
        },
      });
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: product.name,
    description: product.description,
    url,
    brand: { '@type': 'Brand', name: 'OTRACE' },
    productGroupID: product.sku,
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    material: 'Cotton',
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
    name: 'OTRACE Complete Set',
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
      shippingDetails: SHIPPING_DETAILS,
      hasMerchantReturnPolicy: RETURN_POLICY,
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
        name: product.name,
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
  if (jsonLd) parts.push(jsonScript(jsonLd));
  return parts.join('\n');
}

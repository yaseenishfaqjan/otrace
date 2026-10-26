/**
 * schema.org JSON-LD for search engines: organisation, website, breadcrumbs,
 * collection pages and products.
 *
 * Products are a ProductGroup with one variant per colour and size, which is
 * what Google's merchant listings read for apparel. Every claim here mirrors
 * the site's own pages — price from products.ts, free US delivery and the
 * 30-day return window from the Shipping & returns page — so nothing is
 * promised to a search engine that the store does not promise a customer.
 */
import { CONTACT_EMAIL_PUBLIC, ENTITY_SUMMARY } from '@/lib/entity';
import { SIZES, type Product } from '@/lib/products';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/use-page-meta';

const colorParam = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  description: ENTITY_SUMMARY,
  email: CONTACT_EMAIL_PUBLIC,
  logo: absoluteUrl('/icon-512.png'),
  // Empty on purpose: no verified Wikipedia, Wikidata, or social profile URL exists in the repo.
  sameAs: [] as string[],
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

export const collectionLd = (name: string, path: string, products: Product[]) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  url: absoluteUrl(path),
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/product/${p.slug}`),
      name: p.name,
    })),
  },
});

// "Delivery is free on every order" / "United States only for AW2026".
const SHIPPING_DETAILS = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
};

// "Unworn items with tags attached can be returned within 30 days of delivery."
const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 30,
  returnMethod: 'https://schema.org/ReturnByMail',
};

/**
 * FAQPage from the same strings the page renders. Google stopped showing FAQ
 * rich results on 7 May 2026; this is for page understanding and AI extraction,
 * not a promised snippet.
 */
export const faqLd = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
});

export const productLd = (product: Product) => {
  const url = absoluteUrl(`/product/${product.slug}`);
  // No per-variant quantity exists in the catalogue. `preorder` is the only
  // availability flag the API reports; absent means every variant is in stock.
  const availability = product.preorder ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${url}#product`,
    name: product.name,
    description: `${product.tagline} ${product.fabric}`,
    url,
    brand: { '@type': 'Brand', name: SITE_NAME },
    productGroupID: product.sku,
    variesBy: ['https://schema.org/color', 'https://schema.org/size'],
    material: 'Cotton',
    image: product.colorways.flatMap((c) => c.images.map((img) => absoluteUrl(img.src))),
    hasVariant: product.colorways.flatMap((c) =>
      SIZES.map((size) => ({
        '@type': 'Product',
        sku: `${product.sku}-${colorParam(c.name)}-${size}`.toUpperCase(),
        name: `${product.name} — ${c.name} — ${size}`,
        color: c.name,
        size,
        image: c.images.map((img) => absoluteUrl(img.src)),
        offers: {
          '@type': 'Offer',
          url: `${url}?color=${colorParam(c.name)}`,
          price: product.price.toFixed(2),
          priceCurrency: 'USD',
          availability,
          itemCondition: 'https://schema.org/NewCondition',
          shippingDetails: SHIPPING_DETAILS,
          hasMerchantReturnPolicy: RETURN_POLICY,
        },
      })),
    ),
  };
};

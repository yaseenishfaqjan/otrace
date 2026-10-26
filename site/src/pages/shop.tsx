import { Link, useRoute } from 'wouter';
import { CATEGORIES, getCategory, PRODUCTS, productsIn } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { useReveal } from '@/lib/use-reveal';
import NotFound from '@/pages/not-found';

import { usePageMeta } from '@/lib/use-page-meta';
import { breadcrumbLd, collectionLd } from '@/lib/structured-data';
// Search-facing titles and descriptions, written for what people type:
// "heavyweight hoodie", "oversized hoodie", "wide leg sweatpants".
const SHOP_SEO = {
  all: {
    title: 'Shop Heavyweight Hoodies & Sweatpants',
    description:
      'Shop OTRACE AW2026: oversized heavyweight hoodies and wide-leg sweatpants in 450 GSM garment-dyed cotton fleece, in Onyx Black and Warm Cream. Free US shipping.',
  },
  hoodies: {
    title: 'Heavyweight Oversized Hoodies',
    description:
      'Oversized 450 GSM heavyweight fleece hoodies with a dropped shoulder and double-layer hood, garment dyed in Onyx Black and Warm Cream. In stock, free US shipping.',
  },
  bottoms: {
    title: 'Wide-Leg Sweatpants',
    description:
      'Heavyweight 450 GSM wide-leg sweatpants with a ribbed ankle that stacks, cut from the same garment-dyed fleece as the hoodie. Onyx Black and Warm Cream, free US shipping.',
  },
} as const;

export default function Shop() {
  const [isCategory, params] = useRoute('/shop/:category');
  const category = isCategory ? getCategory(params?.category) : undefined;
  useReveal([params?.category]);
  const seo = category ? SHOP_SEO[category.slug as keyof typeof SHOP_SEO] ?? SHOP_SEO.all : SHOP_SEO.all;
  const listed = category ? productsIn(category.slug) : PRODUCTS;
  const shopPath = category ? `/shop/${category.slug}` : '/shop';
  usePageMeta(
    isCategory && !category ? 'Page not found' : seo.title,
    seo.description,
    isCategory && !category
      ? { noindex: true }
      : {
          jsonLd: [
            collectionLd(seo.title, shopPath, listed),
            breadcrumbLd([
              { name: 'Home', path: '/' },
              { name: 'Shop', path: '/shop' },
              ...(category ? [{ name: category.name, path: shopPath }] : []),
            ]),
          ],
        },
  );

  if (isCategory && !category) return <NotFound />;
  const products = category ? productsIn(category.slug) : PRODUCTS;

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell pt-12 md:pt-16 pb-10">
        <p className="eyebrow text-muted mb-4">AW2026</p>
        <h1 className="display text-cream text-[11.5vw] md:text-[4.5rem]">
          {category ? category.name : 'Shop all'}
        </h1>
        <p className="text-cream-dim leading-relaxed mt-5 max-w-lg">
          {category
            ? category.blurb
            : 'Two pieces, two colorways, one fleece. Cut oversized and dyed after they are sewn.'}
        </p>
        <p className="text-cream text-sm mt-4 max-w-lg">
          AW2026 is in stock. Free US delivery, and orders ship in 3&ndash;5 business days.
        </p>

        <nav aria-label="Categories" className="flex flex-wrap gap-2 mt-9">
          <Link
            href="/shop"
            aria-current={!category ? 'page' : undefined}
            className={`px-5 py-2.5 eyebrow border transition-colors ${
              !category ? 'bg-cream text-onyx border-cream' : 'border-line text-cream-dim hover:border-cream-dim'
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              aria-current={category?.slug === c.slug ? 'page' : undefined}
              className={`px-5 py-2.5 eyebrow border transition-colors ${
                category?.slug === c.slug ? 'bg-cream text-onyx border-cream' : 'border-line text-cream-dim hover:border-cream-dim'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="shell pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-14 md:gap-x-8">
          {/* One tile per COLOURWAY, not per product. Two products in a
              two-column grid left half the row empty and the Warm Cream
              versions were reachable only by hovering a black tile, so a
              shopper scanning the grid never saw them. */}
          {products.flatMap((p) => p.colorways.map((c) => ({ product: p, colorway: c })))
            .map(({ product, colorway }, i) => (
              <div
                key={`${product.slug}-${colorway.name}`}
                className="reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <ProductCard
                  product={product}
                  priority={i === 0}
                  heading="h2"
                  colorwayIndex={product.colorways.indexOf(colorway)}
                  lockColorway
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

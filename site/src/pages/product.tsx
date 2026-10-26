import { useEffect, useRef, useState } from 'react';
import { Link, useRoute, useSearch } from 'wouter';
import { ChevronDown, Check } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useReveal } from '@/lib/use-reveal';
import NotFound from '@/pages/not-found';
import { getProduct, money, PRODUCTS, SIZES, SIZE_CHART, IN_STOCK_SHIPS_IN } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { ProductGallery } from '@/components/product-gallery';
import { FaqList } from '@/components/faq-list';
import { FitHelp } from '@/components/fit-help';
import { FabricFeel } from '@/components/fabric-feel';
import { SetSwitcher } from '@/components/set-switcher';
import { SiteImage, webpSrc } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';
import { faqsForProduct } from '@/lib/faqs';

import { usePageMeta } from '@/lib/use-page-meta';
import { breadcrumbLd, faqLd, productLd } from '@/lib/structured-data';
function Accordion({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-line" open={open}>
      <summary className="flex items-center justify-between py-5 cursor-pointer list-none eyebrow text-cream">
        {title}
        <ChevronDown className="w-4 h-4 text-muted transition-transform group-open:rotate-180" strokeWidth={1.5} />
      </summary>
      <div className="pb-6 text-cream-dim text-sm leading-relaxed space-y-3">{children}</div>
    </details>
  );
}

// Search-facing product titles (the page H1 keeps the short product name).
const FLAT_ROWS: Record<string, string[]> = {
  'oversized-hoodie': ['Chest', 'Body length', 'Shoulder'],
  'wide-leg-sweatpant': ['Outseam', 'Inseam', 'Leg opening'],
};

function flatLine(slug: string, size: string) {
  const index = SIZES.indexOf(size as (typeof SIZES)[number]);
  if (index < 0) return '';
  return (FLAT_ROWS[slug] ?? [])
    .flatMap((label) => {
      const value = SIZE_CHART.find((row) => row.label === label)?.values[index];
      return value == null ? [] : [`${label.toLowerCase()} ${value} cm`];
    })
    .join(', ');
}

const PRODUCT_SEO_TITLE: Record<string, string> = {
  'oversized-hoodie': 'Oversized Heavyweight Hoodie, 450 GSM',
  'wide-leg-sweatpant': 'Wide-Leg Heavyweight Sweatpant, 450 GSM',
};

export default function Product() {
  const [, params] = useRoute('/product/:slug');
  const product = getProduct(params?.slug);
  const faqs = product ? faqsForProduct(product.slug) : [];
  usePageMeta(
    product ? PRODUCT_SEO_TITLE[product.slug] ?? product.name : 'Page not found',
    product
      ? // Kept under ~160 characters so search results show it whole.
        `${product.name} in 450 GSM garment-dyed cotton fleece, Onyx Black or Warm Cream. ${money(product.price)}${
          product.preorder ? `, pre-order ships in ${product.preorder.shipsIn}` : ''
        }. Free US shipping.`
      : undefined,
    product
      ? {
          type: 'product',
          image: product.colorways[0].images[0].src,
          jsonLd: [
            productLd(product),
            breadcrumbLd([
              { name: 'Home', path: '/' },
              { name: 'Shop', path: '/shop' },
              { name: product.category, path: `/shop/${product.categorySlug}` },
              { name: product.name, path: `/product/${product.slug}` },
            ]),
            faqLd(faqs),
          ],
        }
      : { noindex: true },
  );
  const { addItem } = useCart();

  // ?color=warm-cream (from the lookbook) opens that colorway.
  const search = useSearch();
  const wanted = (() => {
    const color = new URLSearchParams(search).get('color');
    const i = product?.colorways.findIndex((c) => c.name.toLowerCase().replace(/\s+/g, '-') === color) ?? -1;
    return i > 0 ? i : 0;
  })();

  const [colorIndex, setColorIndex] = useState(wanted);
  const [size, setSize] = useState<string | null>(null);
  const [needsSize, setNeedsSize] = useState(false);
  const [pastAdd, setPastAdd] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [asSet, setAsSet] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef(0);

  useReveal([params?.slug]);

  // Navigating between products reuses this component, so the previous
  // product's selections would otherwise stick.
  useEffect(() => {
    setColorIndex(wanted);
    setSize(null);
    setNeedsSize(false);
    setPastAdd(false);
    setEngaged(false);
    setAsSet(false);
    setAddedFlash(false);
  }, [params?.slug]);

  useEffect(() => {
    // A button that starts below the fold and later sits above it is
    // "not intersecting" in both places, so IntersectionObserver may not
    // fire the second time. Read the box on scroll instead.
    let frame = 0;
    const read = () => {
      frame = 0;
      const button = addButtonRef.current;
      const gallery = galleryRef.current;
      const buttonGone = button ? button.getBoundingClientRect().bottom < 0 : false;
      const galleryLeft = gallery ? gallery.getBoundingClientRect().top < 0 : false;
      const next = buttonGone || (engaged && galleryLeft);
      setPastAdd((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [params?.slug, engaged]);

  // Preload the other colorway so switching paints instantly instead of
  // holding the previous image while the new JPEG downloads.
  useEffect(() => {
    product?.colorways.forEach((c) =>
      c.images.forEach((img) => { const p = new Image(); p.src = webpSrc(img.src); }),
    );
  }, [product]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  if (!product) return <NotFound />;

  const colorway = product.colorways[colorIndex];
  const gallery = colorway.images;
  const partner = PRODUCTS.find((item) => item.slug !== product.slug);
  // The set is a fixed offer, not two singles added up: $200 list, 30% off.
  // api/catalog.js holds the authority and charges the same 14000 cents.
  const SET_PRICE = 140;
  const SET_LIST = 200;
  const setPrice = partner ? SET_PRICE : product.price;
  const singleLabel = `${product.preorder ? 'Pre-order' : 'Add to cart'} — ${money(product.price)}`;
  const setSaving = partner ? SET_LIST - SET_PRICE : 0;
  const setLabel = `Add the set — ${money(setPrice)}` + (setSaving > 0 ? ` (save ${money(setSaving)})` : '');
  const buyLabel = addedFlash ? 'Added' : asSet && partner ? setLabel : singleLabel;

  const add = () => {
    if (!size) {
      setNeedsSize(true);
      return;
    }
    const line = {
      size,
      quantity: 1,
      shipsIn: product.preorder?.shipsIn,
    };
    addItem({
      ...line,
      sku: product.sku,
      name: product.name,
      price: product.price,
      colour: colorway.name,
      image: gallery[0].src,
    });
    if (asSet && partner) {
      const match = partner.colorways.find((c) => c.name === colorway.name) ?? partner.colorways[0];
      addItem({
        ...line,
        sku: partner.sku,
        name: partner.name,
        price: partner.price,
        colour: match.name,
        image: match.images[0].src,
        shipsIn: partner.preorder?.shipsIn,
      });
    }
    setAddedFlash(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedFlash(false), 1400);
  };

  const others = PRODUCTS.filter((p) => p.slug !== product.slug);

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-5">
        <nav className="flex items-center gap-2 text-xs text-muted">
          <Link href="/shop" className="hover:text-cream transition-colors">Shop</Link>
          <span>/</span>
          <span className="text-cream-dim">{product.name}</span>
        </nav>
      </div>

      <div className="shell grid lg:grid-cols-2 gap-8 lg:gap-16 pb-20">
        {/* --------------------------------------------------------- gallery */}
        <div ref={galleryRef}>
          <ProductGallery
            images={gallery}
            badge={product.preorder ? 'Pre-order' : undefined}
            resetKey={`${product.slug}-${colorway.name}`}
            transitionName={`product-${product.slug}`}
            onEngage={() => setEngaged(true)}
            turntable={{ slug: product.slug, colour: colorway.name }}
          />
        </div>

        {/* ------------------------------------------------------------ buy */}
        <div className="lg:py-4">
          <p className="eyebrow text-muted">{product.line}</p>
          <h1 className="text-cream text-xl sm:text-2xl font-medium tracking-tight mt-3">
            {product.name}
          </h1>
          {/* The offer only works if the saving is visible. listPrice is the
              figure before the discount; api/catalog.js charges product.price. */}
          <p className="text-cream-dim text-lg mt-2 tabular-nums flex items-baseline gap-2">
            {product.listPrice > product.price && (
              <span className="text-muted line-through">{money(product.listPrice)}</span>
            )}
            <span className="text-cream">{money(product.price)}</span>
            {product.listPrice > product.price && (
              <span className="eyebrow text-cream/70">
                {Math.round((1 - product.price / product.listPrice) * 100)}% off
              </span>
            )}
          </p>
          <p className="text-cream-dim leading-relaxed mt-6 max-w-md">{product.tagline}</p>

          {/* The terms have to be unmissable BEFORE the size picker. A customer
              who only finds out it is a pre-order in the confirmation email
              charges back, and they are right to. */}
          {product.preorder && (
            <div className="mt-7 border border-line bg-onyx-lift p-5">
              <p className="eyebrow text-cream mb-2">This is a pre-order</p>
              <p className="text-cream-dim text-sm leading-relaxed">
                We take payment today to reserve your size, and your order ships
                in <span className="text-cream">{product.preorder.shipsIn}</span>.
                Change or cancel any time before it ships for a full refund.
              </p>
            </div>
          )}

          {/* colorway */}
          <div className="mt-10">
            <p className="eyebrow text-muted mb-4">
              Color — <span className="text-cream">{colorway.name}</span>
            </p>
            <div className="flex gap-3">
              {product.colorways.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setColorIndex(i)}
                  aria-label={c.name}
                  aria-pressed={colorIndex === i}
                  title={c.name}
                  className={`w-11 h-11 rounded-full border-2 transition-all ${
                    colorIndex === i ? 'border-cream' : 'border-line hover:border-cream-dim'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <SetSwitcher product={product} colour={colorway.name} />

          {/* size */}
          <div className="mt-9">
            <div className="flex items-baseline justify-between mb-4">
              <p className="eyebrow text-muted">Size</p>
              <Link href="/sizing" className="text-xs text-cream-dim hover:text-cream underline underline-offset-4 transition-colors">
                Size guide
              </Link>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setNeedsSize(false); }}
                  aria-pressed={size === s}
                  className={`size-pick h-12 text-xs font-semibold tracking-wider border transition-colors ${
                    size === s
                      ? 'bg-cream text-onyx border-cream'
                      : 'border-line text-cream-dim hover:border-cream-dim'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {needsSize && <p className="text-red-400 text-xs mt-3">Choose a size first.</p>}
            {size && flatLine(product.slug, size) && (
              <p className="text-muted text-xs mt-3 leading-relaxed">
                {size}, laid flat: {flatLine(product.slug, size)}.
              </p>
            )}
            <FitHelp
              productSlug={product.slug}
              productName={product.name}
              size={size}
              colour={colorway.name}
            />
          </div>

          {partner && (
            <button
              type="button"
              aria-pressed={asSet}
              onClick={() => setAsSet((current) => !current)}
              className={`mt-8 w-full border px-4 py-3 text-left ${asSet ? 'border-cream' : 'border-line'}`}
            >
              <span className="eyebrow text-cream">{asSet ? 'Set selected' : 'Buy both pieces'}</span>
              <span className="block text-cream-dim text-sm mt-2 leading-relaxed">
                {product.name} and {partner.name} together for {money(setPrice)} instead of {money(SET_LIST)} — same colour, same size.
              </span>
            </button>
          )}

          {/* Desktop action. On mobile the same action is pinned to the bottom
              of the screen so it is reachable without scrolling back up. */}
          <button ref={addButtonRef} onClick={add} className="btn w-full mt-9 hidden sm:flex">
            {buyLabel}
          </button>

          <ul className="mt-8 space-y-2">
            {[
              'Free delivery on every order',
              product.preorder
                ? `Ships in ${product.preorder.shipsIn}`
                : `In stock · ships in ${IN_STOCK_SHIPS_IN}`,
              product.preorder
                ? 'Cancel any time before it ships'
                : '30-day returns, unworn with tags',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-cream-dim text-sm">
                <Check className="w-3.5 h-3.5 text-cream shrink-0" strokeWidth={2.5} />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Accordion title="Details" open>
              <ul className="space-y-2">
                {product.details.map((d) => (
                  <li key={d} className="flex gap-3">
                    <span className="text-muted">—</span>
                    {d}
                  </li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Fabric &amp; fit">
              <p><span className="text-cream">Fabric.</span> {product.fabric}</p>
              <p><span className="text-cream">Fit.</span> {product.fit}</p>
              <p><span className="text-cream">Care.</span> {product.care}</p>
              <p>
                <Link href="/garment-dyed" className="text-cream underline underline-offset-4">What does garment dyed mean?</Link>
              </p>
            </Accordion>
            <Accordion title="Shipping &amp; returns">
              {product.preorder ? (
                <p>
                  This piece is made to order. Delivery is free and your order
                  ships in {product.preorder.shipsIn}, with tracking emailed the
                  moment it leaves us. Cancel any time before it ships for a full
                  refund.
                </p>
              ) : (
                <p>Free delivery on every order, shipped within {IN_STOCK_SHIPS_IN} with tracking.</p>
              )}
              <p>
                Unworn items with tags can be returned within 30 days. See{' '}
                <Link href="/shipping" className="text-cream underline underline-offset-4">shipping &amp; returns</Link>.
              </p>
            </Accordion>
          </div>
          <FaqList faqs={faqs} />
          <p className="text-cream-dim text-sm mt-6">
            <Link href="/sizing" className="text-cream underline underline-offset-4">Flat measurements</Link>
            {' '}are on the size guide.
          </p>
        </div>
      </div>

      <FabricFeel />

      {/* ---------------------------------------------------- mobile buy bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-onyx/95 backdrop-blur-xl border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={add} className="btn w-full">
          {buyLabel}
        </button>
      </div>

      {/* Desktop only, and only once the in-page button has scrolled away.
          No entrance animation, so reduced motion has nothing to disable. */}
      {pastAdd && (
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-40 bg-onyx/95 backdrop-blur-xl border-t border-line">
          <div className="shell py-3 flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-cream text-sm truncate">{product.name}</p>
              <p className="text-muted text-xs mt-1 truncate">
                {colorway.name}{size ? ` · ${size}` : ''} · {money(product.price)}
              </p>
            </div>
            <button onClick={add} className="btn shrink-0">
              {buyLabel}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ others */}
      <section className="shell pb-32 sm:pb-24">
        <h2 className="display text-cream text-[7vw] sm:text-3xl mb-8 reveal">Complete the set</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-12 md:gap-x-8">
          {others.map((p) => (
            <div key={p.slug} className="reveal">
              <ProductCard product={p} />
            </div>
          ))}

          {/* With a two-piece collection there is only ONE other product, which
              left half the grid empty. Fill the row with the reason to buy both:
              the set, worn. Drops away automatically once there are more pieces. */}
          {others.length === 1 && (
            <Link
              href="/shop"
              className="reveal group relative block aspect-[4/5] overflow-hidden bg-charcoal/30"
            >
              <SiteImage
                src="/campaign.jpg"
                alt="Both OTRACE pieces worn together as a set"
                width={imageSize('/campaign.jpg').width}
                height={imageSize('/campaign.jpg').height}
                loading="lazy"
                pictureClassName="absolute inset-0 block"
                className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-onyx via-onyx/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p className="eyebrow text-cream-dim mb-3">Worn together</p>
                <p className="display text-cream text-[7vw] sm:text-2xl lg:text-3xl">
                  Same fleece.
                  <br />
                  Same dye lot.
                </p>
                <span className="eyebrow text-cream inline-flex items-center gap-2 mt-5 border-b border-cream/40 pb-1 group-hover:border-cream transition-colors">
                  Shop the set
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

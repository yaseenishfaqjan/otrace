import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { useReveal } from '@/lib/use-reveal';
import { HeroMedia } from '@/components/hero-media';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';
import { SplitHeadline } from '@/components/split-headline';

import { usePageMeta } from '@/lib/use-page-meta';
import { organizationLd, websiteLd } from '@/lib/structured-data';
const TICKER = [
  'AW2026 in stock',
  '450 GSM heavyweight fleece',
  'Garment dyed',
  'Cut oversized',
  'Two colorways',
  'Free delivery',
];

const CRAFT = [
  {
    image: '/detail-fabric.jpg',
    title: '450 GSM',
    body: 'Heavyweight loopback fleece, brushed on the inside. It holds its shape from the first wear and keeps it.',
  },
  {
    image: '/detail-drawcord.jpg',
    title: 'Hardware',
    body: 'Metal drawcord tips through metal eyelets. The parts you touch every day are the parts most brands cheapen.',
  },
  {
    image: '/detail-stitch.jpg',
    title: 'Construction',
    body: 'Dropped shoulder seams and a self-lined double-layer hood. Sewn first, dyed after, so the colour settles into the seams.',
  },
];

export default function Home() {
  usePageMeta(undefined, undefined, { jsonLd: [organizationLd(), websiteLd()] });
  useReveal();

  return (
    <>
      {/* ============================================================ hero */}
      <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden">
        <HeroMedia alt="OTRACE AW2026 campaign — oversized hoodie and wide-leg sweatpant in Onyx Black" />
        {/* Two stops, not one: the top scrim carries the header, the bottom
            carries the type. A single flat overlay muddies the whole frame. */}
        <div className="absolute inset-0 bg-gradient-to-b from-onyx/70 via-onyx/10 to-onyx" />
        {/* Phones stack the type lower over a taller subject, so they get a
            deeper bottom scrim to keep the headline off the garment detail. */}
        <div className="md:hidden absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-onyx via-onyx/75 to-transparent" />

        <div className="relative h-full shell flex flex-col justify-end pb-16 md:pb-20">
          <p className="eyebrow text-cream-dim mb-5 fade">
            Autumn / Winter 2026 &mdash; in stock
          </p>
          <SplitHeadline
            lines={['Worn', 'loose']}
            className="display text-cream text-[13vw] md:text-[8vw] xl:text-[7rem]"
            delay={150}
            stagger={55}
          />
          {/* The rest follows the letters in, starting as the last ones land. */}
          <p
            className="hidden md:block text-cream-dim text-lg max-w-md mt-6 leading-relaxed rise"
            style={{ animationDelay: '650ms' }}
          >
            Heavyweight fleece cut boxy and dyed after it is sewn. Two pieces,
            two colorways, made to be worn as a set or broken apart.
            In stock &mdash; ships in 3&ndash;5 business days.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-9 rise" style={{ animationDelay: '780ms' }}>
            <Link href="/shop" className="btn">
              Shop the drop <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
            <Link href="/about" className="btn-ghost">The label</Link>
          </div>
        </div>
      </section>

      {/* ========================================================== ticker */}
      <div className="rule border-b border-line overflow-hidden py-4">
        <div className="ticker flex whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
              {TICKER.map((t) => (
                <span key={t} className="eyebrow text-muted px-7">
                  {t}
                  <span className="ml-7 text-line" aria-hidden="true">/</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ drop */}
      <section className="shell py-20 md:py-28">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-14 reveal">
          <div>
            <p className="eyebrow text-muted mb-4">The drop</p>
            <h2 className="display text-cream text-[9vw] md:text-[3.5rem]">Two pieces</h2>
          </div>
          <Link href="/shop" className="eyebrow text-cream-dim hover:text-cream transition-colors shrink-0 pb-2 hidden sm:block">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-14 md:gap-x-8">
          {PRODUCTS.map((product, i) => (
            <div key={product.slug} className="reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <ProductCard product={product} priority={i === 0} />
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================= the set */}
      <section className="relative">
        <div className="grid md:grid-cols-2 items-stretch">
          <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[42rem] overflow-hidden">
            <SiteImage
              src="/campaign.jpg"
              alt="Both OTRACE colorways worn as a full set — Onyx Black and Warm Cream"
              width={imageSize('/campaign.jpg').width}
              height={imageSize('/campaign.jpg').height}
              loading="lazy"
              pictureClassName="absolute inset-0 block"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-center px-5 md:px-14 xl:px-20 py-16 md:py-0 reveal">
            <p className="eyebrow text-muted mb-5">Onyx Black / Warm Cream</p>
            <h2 className="display text-cream text-[9.5vw] md:text-[3.25rem] xl:text-[4rem]">
              Bought
              <br />
              as a set
            </h2>
            <p className="text-cream-dim leading-relaxed mt-7 max-w-md">
              Hoodie and sweatpant are cut from the same fleece and dyed in the
              same lot, so the tones match exactly. Wear them together or split
              them across everything else you own — they were built to do both.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/shop/hoodies" className="btn-ghost">Hoodies</Link>
              <Link href="/shop/bottoms" className="btn-ghost">Bottoms</Link>
              <Link href="/lookbook" className="btn-ghost">The lookbook</Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================== craft */}
      <section className="shell pt-20 md:pt-28 pb-16 md:pb-20">
        <div className="max-w-2xl mb-12 md:mb-16 reveal">
          <p className="eyebrow text-muted mb-4">Construction</p>
          <h2 className="display text-cream text-[9vw] md:text-[3.5rem]">
            Made heavy
            <br />
            on purpose
          </h2>
        </div>

        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {CRAFT.map((c, i) => (
            <article key={c.title} className="reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="aspect-[4/3] overflow-hidden bg-charcoal/30">
                <SiteImage
                  src={c.image}
                  alt=""
                  width={imageSize(c.image).width}
                  height={imageSize(c.image).height}
                  loading="lazy"
                  pictureClassName="block w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="eyebrow text-cream mt-5">{c.title}</h3>
              <p className="text-cream-dim text-sm leading-relaxed mt-3">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============================================================ mark */}
      <section className="rule overflow-hidden">
        <div className="shell py-20 md:py-32 flex flex-col items-center text-center">
          <p className="eyebrow text-muted mb-10 md:mb-14 reveal">The mark</p>
          <picture className="reveal block w-full max-w-[30rem] md:max-w-[42rem]">
            <source srcSet="/brand/otrace-wordmark-embroidery.webp" type="image/webp" />
            <img
              src="/brand/otrace-wordmark-embroidery.png"
              alt="The OTRACE wordmark embroidered in cream thread"
              width={1600}
              height={1126}
              loading="lazy"
              className="w-full h-auto"
            />
          </picture>
          <p className="text-cream-dim leading-relaxed mt-10 md:mt-14 max-w-sm reveal">
            Cream thread, set in relief. The signature of the label.
          </p>
        </div>
      </section>

      {/* ============================================================ size */}
      <section className="rule">
        <div className="shell py-16 md:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8 reveal">
          <div>
            <h2 className="display text-cream text-[7vw] md:text-[2.25rem]">Not sure of your size?</h2>
            <p className="text-cream-dim mt-3 max-w-lg leading-relaxed">
              Everything is cut oversized. The size guide has the flat
              measurements, and we answer fit questions the same day.
            </p>
          </div>
          <Link href="/sizing" className="btn shrink-0 self-start">Size guide</Link>
        </div>
      </section>
    </>
  );
}

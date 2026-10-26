import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { LOOKS, ROWS, colorParam, type Look } from '@/lib/lookbook';
import { PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { SplitHeadline } from '@/components/split-headline';
import { useReveal } from '@/lib/use-reveal';

import { usePageMeta } from '@/lib/use-page-meta';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';
const pad = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------ pieces ---- */

function Pieces({ look }: { look: Look }) {
  return (
    <div>
      <p className="eyebrow text-cream-dim tabular-nums">Look {pad(look.n)}</p>
      <ul className="mt-3 space-y-1.5">
        {look.pieces.map((piece) => {
          const product = PRODUCTS.find((p) => p.slug === piece.slug);
          if (!product) return null;
          return (
            <li key={`${piece.slug}-${piece.color}`}>
              <Link
                href={`/product/${piece.slug}?color=${colorParam(piece.color)}`}
                className="group inline-flex flex-wrap items-baseline gap-x-2 text-cream text-sm md:text-[0.95rem]"
              >
                <span className="border-b border-cream/0 group-hover:border-cream/70 transition-colors">
                  {product.name}
                </span>
                <span className="text-cream-dim">{piece.color}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------- picture ---- */

function LookPicture({ look, eager = false, sizes }: { look: Look; eager?: boolean; sizes?: string }) {
  const frame = imageSize(look.src);
  return (
    <div className="look-shift absolute inset-0">
    <SiteImage
      src={look.src}
      sources={look.wide ? [{ src: look.wide, media: '(min-width: 768px)' }] : undefined}
      alt={look.alt}
      width={frame.width}
      height={frame.height}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      pictureClassName="absolute inset-0 block"
      style={look.position ? { objectPosition: look.position } : undefined}
      className="look-img w-full h-full object-cover"
    />
    </div>
  );
}

/* A single look filling the screen (or half of it, inside a desktop pair). */
function LookFrame({ look, half = false }: { look: Look; half?: boolean }) {
  return (
    <section
      data-look={look.n}
      aria-label={`Look ${look.n}`}
      className="look relative h-[100svh] min-h-[560px] overflow-clip bg-charcoal/30"
    >
      <LookPicture look={look} sizes={half ? '(min-width: 768px) 50vw, 100vw' : '100vw'} />
      <div
        className={`absolute inset-x-0 bottom-0 pt-40 pb-10 md:pb-12 bg-gradient-to-t from-onyx/85 via-onyx/35 to-transparent ${
          half ? 'px-5 md:px-10' : 'shell'
        }`}
      >
        <div className="reveal">
          <Pieces look={look} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------- progress counter -- */

/**
 * Which look(s) are on screen. A desktop pair shows two at once, so the counter
 * reads "02–03" there rather than skipping a number.
 */
function useVisibleLooks() {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(Number((e.target as HTMLElement).dataset.look), e.intersectionRatio);
        }
        const on = [...ratios].filter(([, r]) => r >= 0.5).map(([n]) => n).sort((a, b) => a - b);
        setVisible((prev) => (prev.join() === on.join() ? prev : on));
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    document.querySelectorAll<HTMLElement>('[data-look]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return visible;
}

function Counter({ visible }: { visible: number[] }) {
  const total = LOOKS.length;
  const first = visible[0];
  const last = visible[visible.length - 1];
  const shown = visible.length > 0;
  // Keep the last label while fading out so the number does not blank mid-fade.
  const [label, setLabel] = useState('01');
  const [progress, setProgress] = useState(1 / total);

  useEffect(() => {
    if (!shown) return;
    setLabel(first === last ? pad(first) : `${pad(first)}–${pad(last)}`);
    setProgress(last / total);
  }, [shown, first, last, total]);

  return (
    <div
      aria-hidden="true"
      className={`fixed z-40 right-5 top-[5.25rem] md:top-auto md:right-8 md:bottom-8 transition-opacity duration-500 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="eyebrow text-cream tabular-nums bg-onyx/55 backdrop-blur-md border border-cream/15 px-3.5 py-2">
        {label} <span className="text-cream-dim">/ {pad(total)}</span>
      </div>
      <div className="h-px bg-cream/20 mt-1.5">
        <div
          className="h-px bg-cream origin-left transition-transform duration-500"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- page ---- */

export default function Lookbook() {
  usePageMeta(
    'AW2026 Lookbook',
    'The OTRACE AW2026 lookbook, Chapter I: Concrete. Ten looks in heavyweight oversized hoodies and wide-leg sweatpants, Onyx Black and Warm Cream. Shop every piece.',
    { image: '/lookbook/look-01-wide.jpg' },
  );
  useReveal();
  const visible = useVisibleLooks();
  const cover = LOOKS[0];

  // Looks settle into place when a swipe or scroll comes to rest near one.
  // Proximity, not mandatory, so the footer and the shop grid stay reachable.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('snap-looks');
    return () => root.classList.remove('snap-looks');
  }, []);

  // A few pixels of shift on desktop. Phones and reduced motion stay still.
  useEffect(() => {
    const fine = window.matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)').matches;
    if (!fine) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      document.querySelectorAll<HTMLElement>('[data-look]').forEach((el) => {
        const shift = el.querySelector<HTMLElement>('.look-shift');
        if (!shift) return;
        const rect = el.getBoundingClientRect();
        const place = (rect.top + rect.height / 2) / window.innerHeight - 0.5;
        const px = Math.max(-16, Math.min(16, place * -16));
        shift.style.setProperty('--look-shift', px.toFixed(2));
      });
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
  }, []);

  return (
    <>
      {/* =========================================================== cover */}
      <section
        data-look={cover.n}
        aria-label="Look 1"
        className="look relative h-[100svh] min-h-[560px] overflow-clip bg-charcoal/30"
      >
        <LookPicture look={cover} eager />
        <div className="absolute inset-0 bg-gradient-to-b from-onyx/60 via-onyx/5 to-onyx/90" />
        <div className="absolute inset-x-0 bottom-0 shell pb-10 md:pb-14">
          <p className="eyebrow text-cream-dim mb-5 fade">AW2026 Lookbook &mdash; Chapter I</p>
          <SplitHeadline
            lines={['Concrete']}
            className="display text-cream text-[14vw] md:text-[11vw] xl:text-[10rem]"
            delay={150}
            stagger={60}
          />
          <div className="mt-8 md:mt-10 flex items-end justify-between gap-6 rise" style={{ animationDelay: '750ms' }}>
            <Pieces look={cover} />
            <span className="hidden md:inline-flex items-center gap-4 eyebrow text-cream-dim">
              Scroll
              <span className="scroll-cue" />
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================ looks */}
      {ROWS.map((row, i) => {
        if (row.kind === 'full') return <LookFrame key={i} look={row.look} />;
        if (row.kind === 'pair') {
          return (
            <div key={i} className="md:grid md:grid-cols-2">
              <LookFrame look={row.looks[0]} half />
              <LookFrame look={row.looks[1]} half />
            </div>
          );
        }
        return (
          <section key={i} className="look min-h-[100svh] flex items-center">
            <div className="shell py-24">
              <h2 className="display text-cream text-[12.5vw] md:text-[7vw] xl:text-[6.5rem] reveal">
                {row.lines.map((line, j) => (
                  <span key={j} className="block">
                    {line}
                  </span>
                ))}
              </h2>
              <p className="text-cream-dim text-base md:text-lg leading-relaxed max-w-md mt-8 reveal">{row.body}</p>
            </div>
          </section>
        );
      })}

      {/* ============================================================= shop */}
      <section className="rule">
        <div className="shell py-20 md:py-28">
          <div className="flex items-end justify-between gap-6 mb-10 md:mb-14 reveal">
            <div>
              <p className="eyebrow text-muted mb-4">End of Chapter I</p>
              <h2 className="display text-cream text-[9vw] md:text-[3.5rem]">Shop the looks</h2>
            </div>
            <Link
              href="/shop"
              className="eyebrow text-cream-dim hover:text-cream transition-colors shrink-0 pb-2 hidden sm:inline-flex items-center gap-2"
            >
              View all <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-14 md:gap-x-8">
            {PRODUCTS.map((product, i) => (
              <div key={product.slug} className="reveal" style={{ transitionDelay: `${i * 90}ms` }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <Counter visible={visible} />
    </>
  );
}

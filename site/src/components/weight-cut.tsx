import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

/**
 * Photographs of the hoodie, stacked with a small perspective so the boxy
 * block reads as an object. No model file exists, so this is not a 3D mesh.
 * The hero above stays the LCP image; these two load lazy.
 * Pointer tilt only on a fine pointer, and only when motion is allowed.
 */
export function WeightCut() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      el.style.setProperty('--tilt-y', `${(x * 9).toFixed(2)}deg`);
      el.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
    };
    const onLeave = () => {
      el.style.removeProperty('--tilt-y');
      el.style.removeProperty('--tilt-x');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const front = imageSize('/products/hoodie-onyx-worn-front.jpg');
  const back = imageSize('/products/hoodie-onyx-worn-back.jpg');

  return (
    <section className="rule">
      <div className="shell py-16 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div ref={stage} className="weight-stage">
          <div className="weight-card">
            <SiteImage
              src="/products/hoodie-onyx-worn-back.jpg"
              alt=""
              width={back.width}
              height={back.height}
              loading="lazy"
              pictureClassName="block"
              className="w-full h-auto"
            />
            <SiteImage
              src="/products/hoodie-onyx-worn-front.jpg"
              alt="Onyx Black oversized hoodie, front and back, set apart so the boxy block reads"
              width={front.width}
              height={front.height}
              loading="lazy"
              pictureClassName="weight-front block"
              className="w-full h-auto"
            />
          </div>
        </div>
        <div>
          <p className="eyebrow text-muted mb-4">450 GSM · boxy cut</p>
          <h2 className="display text-cream text-[9vw] md:text-[3.25rem]">
            Weight
            <br />
            and cut
          </h2>
          <p className="text-cream-dim leading-relaxed mt-6 max-w-md">
            One square metre of this fleece weighs 450 grams. The body is a
            straight block with a dropped shoulder, sewn first and dyed after.
            These are the product photographs, layered so the silhouette reads
            before you open the page.
          </p>
          <Link href="/product/oversized-hoodie" className="btn mt-8">
            Shop the hoodie <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

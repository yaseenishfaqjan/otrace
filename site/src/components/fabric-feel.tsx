import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';
import { useReducedMotion } from '@/lib/reduced-motion';
import { WeightScale } from '@/components/weight-scale';

const FRAMES = [
  {
    src: '/detail-fabric.jpg',
    label: 'Cloth',
    alt: 'Close view of the OTRACE 450 GSM loopback cotton fleece, brushed on the inside',
    note: 'Loopback cotton, brushed on the inside. 450 grams per square metre.',
  },
  {
    src: '/detail-stitch.jpg',
    label: 'Stitch',
    alt: 'Dropped shoulder seam on the OTRACE oversized hoodie after garment dyeing',
    note: 'Sewn first, then dyed, so the colour settles into the seam.',
  },
  {
    src: '/detail-drawcord.jpg',
    label: 'Drawcord',
    alt: 'White moulded plastic drawcord tip through a metal eyelet on the OTRACE hoodie',
    note: 'White moulded plastic tips through metal eyelets.',
  },
] as const;

/**
 * Drag across the three cloth photographs that already exist. No generated
 * texture and no animation when the visitor asks for reduced motion.
 */
export function FabricFeel() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const driven = useRef(false);
  const [index, setIndex] = useState(0);
  const [shift, setShift] = useState(50);
  const [scale, setScale] = useState(1);
  const origin = useRef<{ x: number; index: number; id: number } | null>(null);
  const frame = FRAMES[index];

  // Scroll moves across the three photographs while this section crosses the
  // screen. It does not take over the page scroll. A drag or the range wins.
  useEffect(() => {
    if (reduced) return;
    let frameId = 0;
    const read = () => {
      frameId = 0;
      const el = section.current;
      if (!el || driven.current) return;
      const rect = el.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      const p = Math.min(1, Math.max(0, progress));
      setIndex(Math.round(p * (FRAMES.length - 1)));
      setShift(28 + p * 44);
      setScale(1.06 - p * 0.06);
    };
    const onScroll = () => {
      if (!frameId) frameId = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [reduced]);

  const stepTo = (clientX: number, width: number, startIndex: number) => {
    const span = FRAMES.length - 1;
    const dx = clientX - (origin.current?.x ?? clientX);
    const next = Math.round(startIndex + (-dx / Math.max(1, width)) * span);
    setIndex(Math.max(0, Math.min(span, next)));
  };

  return (
    <section ref={section} className="shell py-16 md:py-24 border-t border-line">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-end">
        <div className="min-w-0">
          <p className="eyebrow text-muted mb-4">Fabric</p>
          <h2 className="display text-cream text-[10vw] lg:text-[3.25rem]">Feel the<br />450 GSM</h2>
          <p className="text-cream-dim leading-relaxed mt-6 max-w-md">
            GSM is the weight of one square metre of cloth. This fleece is 450 grams:
            heavyweight cotton, pre-shrunk, garment dyed. Drag across the cloth,
            the stitch, and the drawcord.
          </p>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-md">
            <Link href="/blog/what-is-a-450-gsm-hoodie" className="text-cream underline underline-offset-4">What 450 GSM means</Link>
            {' · '}
            <Link href="/garment-dyed" className="text-cream underline underline-offset-4">Why it is garment dyed</Link>
          </p>
          <WeightScale />
        </div>

        <div className="min-w-0">
          <div
            className="relative aspect-[4/3] overflow-hidden bg-charcoal/30"
            onPointerDown={(e) => {
              driven.current = true;
              if (e.pointerType === 'mouse') {
                origin.current = { x: e.clientX, index, id: e.pointerId };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              if (!reduced && e.pointerType === 'mouse') {
                const x = (e.clientX - box.left) / Math.max(1, box.width);
                setShift(35 + x * 30);
              }
              const start = origin.current;
              if (!start || start.id !== e.pointerId) return;
              if (Math.abs(e.clientX - start.x) < 10) return;
              stepTo(e.clientX, box.width, start.index);
            }}
            onPointerUp={(e) => {
              if (origin.current?.id === e.pointerId) origin.current = null;
            }}
            onPointerCancel={() => { origin.current = null; }}
          >
            <SiteImage
              src={frame.src}
              alt={frame.alt}
              width={imageSize(frame.src).width}
              height={imageSize(frame.src).height}
              loading="lazy"
              draggable={false}
              pictureClassName="absolute inset-0 block"
              className="w-full h-full object-cover"
              style={reduced ? undefined : { objectPosition: `${shift}% 50%`, transform: `scale(${scale})` }}
            />
          </div>
          <div className="mt-4 min-w-0">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <p className="eyebrow text-muted">{frame.label}</p>
              <p className="text-cream-dim text-xs tabular-nums">{index + 1} / {FRAMES.length}</p>
            </div>
            <input
              type="range"
              className="scrub-range"
              min={0}
              max={FRAMES.length - 1}
              step={1}
              value={index}
              aria-label="Drag across the cloth, stitch, and drawcord"
              aria-valuetext={frame.label}
              onChange={(e) => {
                driven.current = true;
                setScale(1);
                setIndex(Number(e.target.value));
              }}
            />
            <p className="text-cream-dim text-sm leading-relaxed mt-3">{frame.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

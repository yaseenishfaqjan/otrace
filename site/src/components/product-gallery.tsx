import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ProductImage } from '@/lib/products';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';
import { sequenceFromManifest, blendOpacity, type TurntableSequence } from '@/lib/turntable';
import { useReducedMotion } from '@/lib/reduced-motion';

/**
 * Product gallery: a drag that crossfades the photographs we already have,
 * hover-zoom on desktop, and a full-screen viewer with tap-to-zoom.
 *
 * A real turntable (24–36 frames) replaces those photographs only after
 * public/turntable/manifest.json names the files and the first frame loads.
 * The first photograph stays a normal image so it can be the LCP element.
 * The lightbox still uses scroll-snap. The page itself does not.
 */

type Props = {
  images: ProductImage[];
  /** Shown top-left on the main frame, e.g. "Pre-order". */
  badge?: string;
  /** Changes with the product or colorway; resets to the first frame. */
  resetKey: string;
  /** view-transition-name for the photo on screen, so a card can morph into it. */
  transitionName?: string;
  /** Fired once a drag or horizontal swipe actually moves between frames. */
  onEngage?: () => void;
  /** Looks up public/turntable/manifest.json. Absent means photographs only. */
  turntable?: { slug: string; colour: string };
};

type Frame = ProductImage & { width: number; height: number };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToIndex(el: HTMLDivElement | null, i: number, smooth: boolean) {
  if (!el) return;
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}

/** Which snapped frame is in view, read from scroll position. */
function useSnapIndex(ref: RefObject<HTMLDivElement | null>, count: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setIndex(Math.max(0, Math.min(count - 1, i)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    read();
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, count]);

  return index;
}

export function ProductGallery({ images, badge, resetKey, transitionName, onEngage, turntable }: Props) {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState(0);
  const [sequence, setSequence] = useState<TurntableSequence | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scrub = useRef<{ x: number; y: number; pos: number; id: number; axis: 'x' | 'y' | null } | null>(null);
  const suppressClick = useRef(false);
  const coast = useRef(0);
  const sample = useRef({ t: 0, pos: 0, v: 0 });
  const posRef = useRef(0);
  const [ghost, setGhost] = useState<{ src: string; width: number; height: number } | null>(null);
  const firstSrc = images[0]?.src;
  const previousSrc = useRef(firstSrc);
  posRef.current = pos;

  const frames: Frame[] = sequence
    ? sequence.urls.map((src, i) => ({
        src,
        label: `Frame ${i + 1}`,
        alt: `${images[0]?.alt ?? 'Product photograph'}, frame ${i + 1} of ${sequence.urls.length}`,
        width: sequence.width,
        height: sequence.height,
      }))
    : images.map((img) => ({ ...img, ...imageSize(img.src) }));
  const last = Math.max(0, frames.length - 1);
  const index = Math.max(0, Math.min(last, Math.round(pos)));

  useEffect(() => () => cancelAnimationFrame(coast.current), []);

  // Colourway changes dissolve the previous frame out. Reduced motion skips it.
  useEffect(() => {
    const before = previousSrc.current;
    previousSrc.current = firstSrc;
    if (!before || !firstSrc || before === firstSrc || reducedMotion()) return;
    const size = imageSize(before);
    setGhost({ src: before, width: size.width, height: size.height });
    const timer = window.setTimeout(() => setGhost(null), 520);
    return () => window.clearTimeout(timer);
  }, [firstSrc]);

  // New product or colorway: straight back to the first frame, no animation.
  useEffect(() => {
    setPos(0);
    setSequence(null);
  }, [resetKey]);

  // A turntable replaces the photographs only after its first frame actually loads.
  useEffect(() => {
    if (!turntable) return;
    let cancel = false;
    fetch('/turntable/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const next = sequenceFromManifest(data, turntable.slug, turntable.colour);
        if (!next || cancel) return;
        const probe = new Image();
        probe.onload = () => {
          if (!cancel) setSequence(next);
        };
        probe.src = next.urls[0];
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [turntable?.slug, turntable?.colour]);

  const go = useCallback(
    (i: number) => {
      setPos(Math.max(0, Math.min(last, i)));
    },
    [last],
  );

  // Hover-zoom follows the cursor. Written straight to the element's style so
  // moving the mouse never triggers a React render. Mouse only — a touch
  // "hover" would leave the image stuck at 2x after a tap.
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  };

  // Where to land once the viewer has closed. The scroll happens in an effect
  // AFTER the viewer unmounts: restoring focus to the button that opened it made
  // the browser scroll that photo back into view, undoing any step taken inside
  // the viewer.
  const returnTo = useRef<number | null>(null);

  // Stable identity: the viewer's effect depends on it (see the /order/success
  // render loop for what an unstable callback in a dependency list does).
  const closeViewer = useCallback((at: number) => {
    returnTo.current = at;
    setViewer(null);
  }, []);

  useEffect(() => {
    if (viewer !== null || returnTo.current === null) return;
    const at = returnTo.current;
    returnTo.current = null;
    setPos(at);
    stage.current?.focus({ preventScroll: true });
  }, [viewer]);

  const many = images.length > 1;

  // Drag crossfades between frames. A vertical touch still scrolls the page.
  // Reduced motion snaps to the nearest photograph and does not coast.
  const stopCoast = () => {
    if (coast.current) cancelAnimationFrame(coast.current);
    coast.current = 0;
  };

  const onScrubDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!many) return;
    if ((e.target as HTMLElement).closest('[data-gallery-control]')) return;
    stopCoast();
    scrub.current = { x: e.clientX, y: e.clientY, pos, id: e.pointerId, axis: e.pointerType === 'mouse' ? 'x' : null };
    sample.current = { t: performance.now(), pos, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onScrubMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && !scrub.current) onPointerMove(e);
    const origin = scrub.current;
    if (!origin || origin.id !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (!origin.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      origin.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (origin.axis !== 'x') return;
    suppressClick.current = true;
    setScrubbing(true);
    onEngage?.();
    const width = stage.current?.clientWidth || 1;
    const raw = origin.pos + (-dx / width) * last;
    const next = Math.max(0, Math.min(last, reducedMotion() ? Math.round(raw) : raw));
    const now = performance.now();
    const dt = now - sample.current.t;
    if (dt > 0) sample.current = { t: now, pos: next, v: ((next - sample.current.pos) / dt) * 16 };
    setPos(next);
  };

  const onScrubEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (scrub.current?.id !== e.pointerId) return;
    const dragged = scrub.current.axis === 'x';
    scrub.current = null;
    setScrubbing(false);
    if (!dragged) return;
    const vel = sample.current.v;
    if (reducedMotion() || Math.abs(vel) < 0.08) {
      setPos((current) => Math.round(current));
      return;
    }
    let frame = sample.current.pos;
    let v = Math.max(-0.55, Math.min(0.55, vel));
    const tick = () => {
      frame = Math.max(0, Math.min(last, frame + v));
      v *= 0.86;
      setPos(frame);
      const atEnd = frame <= 0 || frame >= last;
      if (Math.abs(v) > 0.02 && !atEnd) coast.current = requestAnimationFrame(tick);
      else setPos(Math.round(frame));
    };
    coast.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const el = stage.current;
    if (!el || !many) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      onEngage?.();
      const delta = event.deltaX / 180;
      setPos((current) => {
        const raw = current + delta;
        const next = Math.max(0, Math.min(last, reducedMotion() ? Math.round(raw) : raw));
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [many, last, onEngage]);

  return (
    <div>
      <div className={`relative group/gallery ${scrubbing ? 'gallery-scrubbing' : ''}`}>
        {badge && (
          <span className="absolute top-4 left-4 z-10 eyebrow bg-cream text-onyx px-3 py-2 leading-none pointer-events-none">
            {badge}
          </span>
        )}
        {ghost && (
          <img
            src={ghost.src}
            alt=""
            width={ghost.width}
            height={ghost.height}
            className="colour-ghost absolute inset-0 z-[5] h-full w-full object-cover pointer-events-none"
          />
        )}

        <button
          ref={stage}
          type="button"
          aria-label={`Open ${frames[index]?.label.toLowerCase() ?? 'product'} image full screen`}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setViewer(index);
          }}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubEnd}
          onPointerCancel={onScrubEnd}
          className="zoom-wrap relative block w-full aspect-[4/5] overflow-hidden bg-charcoal/25"
          style={{ touchAction: 'pan-y' }}
        >
          {frames.map((img, i) => {
            const opacity = blendOpacity(pos, i, reduced);
            if (Math.abs(pos - i) > 1 && i !== 0) return null;
            return (
              <SiteImage
                key={img.src}
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                draggable={false}
                pictureClassName="absolute inset-0 block"
                style={
                  transitionName && i === index
                    ? ({ viewTransitionName: transitionName, opacity } as React.CSSProperties)
                    : { opacity }
                }
                className="zoom-img w-full h-full object-cover"
              />
            );
          })}
        </button>

        {many && (
          <>
            {/* Arrows are for pointers; phones swipe. */}
            <button
              type="button"
              data-gallery-control=""
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center bg-onyx/70 text-cream opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              data-gallery-control=""
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="hidden sm:grid absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center bg-onyx/70 text-cream opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <span
              aria-live="polite"
              className="sm:hidden absolute top-4 right-4 eyebrow bg-onyx/70 text-cream px-2.5 py-1.5 leading-none tabular-nums pointer-events-none"
            >
              {index + 1} / {frames.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="mt-4 min-w-0">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <p className="eyebrow text-muted">Angles</p>
            <p className="text-cream-dim text-xs">{frames[index]?.label}</p>
          </div>
          <input
            type="range"
            className="scrub-range"
            min={0}
            max={last}
            step={0.01}
            value={pos}
            aria-label={sequence ? 'Drag to turn the photographed frames' : 'Drag across the photographs'}
            aria-valuetext={frames[index]?.label ?? ''}
            onChange={(e) => {
              const value = Number(e.target.value);
              setPos(reducedMotion() ? Math.round(value) : value);
              onEngage?.();
            }}
          />
          <p className="text-muted text-[11px] leading-relaxed mt-2">
            {sequence
              ? 'Drag to turn the photographed frames. This is not a 3D model.'
              : 'Drag to move between the photographs we have. A full turntable is not on the site yet.'}
          </p>
        </div>
      )}

      {many && (
        <>
          {frames.length <= 8 && (
          <div className="sm:hidden flex justify-center gap-2 mt-4" aria-hidden="true">
            {frames.map((img, i) => (
              <span
                key={img.src}
                className={`motion-dot h-[3px] transition-all duration-300 ${i === index ? 'w-6 bg-cream' : 'w-3 bg-cream/25'}`}
              />
            ))}
          </div>
          )}

          {!sequence && (
          <div className="hidden sm:grid grid-cols-4 gap-2 md:gap-3 mt-2 md:mt-3">
            {frames.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`View ${img.label.toLowerCase()}`}
                aria-pressed={index === i}
                className={`bg-charcoal/25 aspect-[4/5] overflow-hidden border transition-colors ${
                  index === i ? 'border-cream' : 'border-transparent hover:border-line'
                }`}
              >
                <SiteImage
                  src={img.src}
                  alt=""
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  pictureClassName="block w-full h-full"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
          )}
        </>
      )}

      {viewer !== null && <Viewer images={frames} start={viewer} onClose={closeViewer} />}
    </div>
  );
}

/* ------------------------------------------------------------------ viewer */

function Viewer({
  images,
  start,
  onClose,
}: {
  images: Frame[];
  start: number;
  onClose: (at: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const index = useSnapIndex(track, images.length);
  const indexRef = useRef(start);
  indexRef.current = index;

  // Open on the frame that was tapped, before paint, without animating there.
  useLayoutEffect(() => {
    scrollToIndex(track.current, start, false);
  }, [start]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();

    const step = (delta: number) => {
      setZoomed(false);
      const next = Math.max(0, Math.min(images.length - 1, indexRef.current + delta));
      scrollToIndex(track.current, next, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(indexRef.current);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // preventScroll: focusing the opener must not drag the carousel back to
      // it; the gallery then moves focus to the photo that was closed on.
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [images.length, onClose]);

  // Zoom in on the point that was tapped, so the detail under the finger stays
  // under the finger. Panning is native scrolling inside the slide.
  const toggleZoom = (e: React.MouseEvent<HTMLImageElement>, i: number) => {
    if (zoomed) {
      setZoomed(false);
      return;
    }
    // The element box is the whole slide and object-contain letterboxes the photo
    // inside it. Work out where the picture actually sits, so the zoom centres
    // on the detail that was tapped rather than a point in the letterbox.
    const el = e.currentTarget;
    const box = el.getBoundingClientRect();
    const nw = el.naturalWidth || box.width;
    const nh = el.naturalHeight || box.height;
    const scale = Math.min(box.width / nw, box.height / nh);
    const w = nw * scale;
    const h = nh * scale;
    const left = box.left + (box.width - w) / 2;
    const top = box.top + (box.height - h) / 2;
    const fx = Math.min(1, Math.max(0, (e.clientX - left) / w));
    const fy = Math.min(1, Math.max(0, (e.clientY - top) / h));
    setZoomed(true);
    requestAnimationFrame(() => {
      const slide = slides.current[i];
      if (!slide) return;
      slide.scrollLeft = fx * slide.scrollWidth - slide.clientWidth / 2;
      slide.scrollTop = fy * slide.scrollHeight - slide.clientHeight / 2;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[90] bg-onyx flex flex-col fade"
    >
      <div className="flex items-center justify-between px-5 h-16 shrink-0">
        <span aria-live="polite" className="eyebrow text-cream-dim tabular-nums">
          {index + 1} / {images.length}
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline eyebrow text-muted">
            {zoomed ? 'Click to zoom out' : 'Click image to zoom'}
          </span>
          <button
            ref={closeBtn}
            type="button"
            onClick={() => onClose(index)}
            aria-label="Close image viewer"
            className="-mr-2 p-2 text-cream"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* sm:py-6 gives the photo air top and bottom on larger screens; flush
          to the screen edge it read as cropped even though it fit. */}
      <div className="relative flex-1 min-h-0 sm:py-6">
        <div
          ref={track}
          className={`no-scrollbar h-full flex snap-x snap-mandatory ${zoomed ? 'overflow-hidden' : 'overflow-x-auto'}`}
        >
          {images.map((img, i) => {
            const here = zoomed && i === index;
            return (
              <div
                key={img.src}
                ref={(el) => { slides.current[i] = el; }}
                className={`no-scrollbar relative shrink-0 w-full h-full snap-start snap-always ${
                  here ? 'overflow-auto' : 'overflow-hidden'
                }`}
              >
                {/* Unzoomed, the image fills the slide box and object-contain fits
                    the photo inside it. The earlier grid + max-h-full version let
                    the grid's auto row grow to the photo's natural height, so on a
                    wide screen the bottom of every portrait shot ran off the
                    viewport. */}
                <SiteImage
                  src={img.src}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  draggable={false}
                  onClick={(e) => toggleZoom(e, i)}
                  pictureClassName={here ? 'block' : 'absolute inset-0 block'}
                  className={`select-none [touch-action:manipulation] ${
                    here
                      ? 'block max-w-none w-[220%] h-auto cursor-zoom-out'
                      : 'w-full h-full object-contain cursor-zoom-in'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {images.length > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => { setZoomed(false); scrollToIndex(track.current, Math.max(0, index - 1), true); }}
              aria-label="Previous image"
              disabled={index === 0}
              className="hidden sm:grid absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 place-items-center border border-cream/30 text-cream disabled:opacity-20"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => { setZoomed(false); scrollToIndex(track.current, Math.min(images.length - 1, index + 1), true); }}
              aria-label="Next image"
              disabled={index === images.length - 1}
              className="hidden sm:grid absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 place-items-center border border-cream/30 text-cream disabled:opacity-20"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      <p className="sm:hidden eyebrow text-muted text-center py-4 shrink-0">
        {zoomed ? 'Drag to look around · tap to zoom out' : 'Tap to zoom · swipe to browse'}
      </p>
    </div>
  );
}

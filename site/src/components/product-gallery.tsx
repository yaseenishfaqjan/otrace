import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ProductImage } from '@/lib/products';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

/**
 * Product gallery: native swipe on phones, hover-zoom on desktop, and a
 * full-screen viewer with tap-to-zoom and pan on both.
 *
 * The swipe is CSS scroll-snap, not a JS carousel. It gets the platform's own
 * momentum and edge feel for free, costs no library, and still swipes if this
 * script fails. Scroll position is the single source of truth — the counter,
 * dots and thumbnails all follow it rather than driving it.
 */

type Props = {
  images: ProductImage[];
  /** Shown top-left on the main frame, e.g. "Pre-order". */
  badge?: string;
  /** Changes with the product or colorway; resets to the first frame. */
  resetKey: string;
  /** view-transition-name for the photo on screen, so a card can morph into it. */
  transitionName?: string;
};

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

export function ProductGallery({ images, badge, resetKey, transitionName }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const index = useSnapIndex(track, images.length);
  const [viewer, setViewer] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scrub = useRef<{ x: number; index: number; id: number } | null>(null);
  const suppressClick = useRef(false);

  // New product or colorway: straight back to the first frame, no animation.
  useEffect(() => {
    scrollToIndex(track.current, 0, false);
  }, [resetKey]);

  const go = useCallback(
    (i: number) => {
      const n = images.length;
      scrollToIndex(track.current, (i + n) % n, true);
    },
    [images.length],
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
    scrollToIndex(track.current, at, false);
    // Keyboard focus goes to the photo actually on screen, without scrolling.
    (track.current?.children[at] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }, [viewer]);

  const many = images.length > 1;

  // Mouse drag steps through the existing photographs. Touch keeps the native
  // swipe. The jump is instant either way, so reduced motion does not animate.
  const onScrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!many || e.pointerType !== 'mouse') return;
    if ((e.target as HTMLElement).closest('[data-gallery-control]')) return;
    scrub.current = { x: e.clientX, index, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const origin = scrub.current;
    if (!origin || origin.id !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    if (Math.abs(dx) < 12) return;
    suppressClick.current = true;
    setScrubbing(true);
    const width = track.current?.clientWidth || 1;
    const span = Math.max(1, images.length - 1);
    const next = Math.round(origin.index + (-dx / width) * span);
    scrollToIndex(track.current, Math.max(0, Math.min(images.length - 1, next)), false);
  };

  const onScrubEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrub.current?.id !== e.pointerId) return;
    scrub.current = null;
    setScrubbing(false);
  };

  return (
    <div>
      <div
        className={`relative group/gallery ${scrubbing ? 'gallery-scrubbing' : ''}`}
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
      >
        {badge && (
          <span className="absolute top-4 left-4 z-10 eyebrow bg-cream text-onyx px-3 py-2 leading-none pointer-events-none">
            {badge}
          </span>
        )}

        <div
          ref={track}
          role="region"
          aria-roledescription="carousel"
          aria-label="Product images"
          className="no-scrollbar flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain bg-charcoal/25"
        >
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                setViewer(i);
              }}
              onPointerMove={onPointerMove}
              aria-label={`Open ${img.label.toLowerCase()} image full screen`}
              className="zoom-wrap relative shrink-0 w-full snap-start snap-always aspect-[4/5] overflow-hidden"
            >
              <SiteImage
                src={img.src}
                alt={img.alt}
                width={imageSize(img.src).width}
                height={imageSize(img.src).height}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                draggable={false}
                pictureClassName="block w-full h-full"
                // Only the photo actually on screen carries the name: a named image
                // scrolled out of view is still captured, unclipped, and would
                // drift across the page during the transition.
                style={
                  transitionName && i === index
                    ? ({ viewTransitionName: transitionName } as React.CSSProperties)
                    : undefined
                }
                className="zoom-img w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

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
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="mt-4 min-w-0">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <p className="eyebrow text-muted">Angles</p>
            <p className="text-cream-dim text-xs">{images[index]?.label}</p>
          </div>
          <input
            type="range"
            className="scrub-range"
            min={0}
            max={images.length - 1}
            step={1}
            value={index}
            aria-label="Drag across the angles"
            aria-valuetext={images[index]?.label ?? ''}
            onChange={(e) => scrollToIndex(track.current, Number(e.target.value), false)}
          />
          <p className="text-muted text-[11px] leading-relaxed mt-2">
            Drag across the photographs. These are the shots we have, not a 3D model.
          </p>
        </div>
      )}

      {many && (
        <>
          <div className="sm:hidden flex justify-center gap-2 mt-4" aria-hidden="true">
            {images.map((img, i) => (
              <span
                key={img.src}
                className={`motion-dot h-[3px] transition-all duration-300 ${i === index ? 'w-6 bg-cream' : 'w-3 bg-cream/25'}`}
              />
            ))}
          </div>

          <div className="hidden sm:grid grid-cols-4 gap-2 md:gap-3 mt-2 md:mt-3">
            {images.map((img, i) => (
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
                  width={imageSize(img.src).width}
                  height={imageSize(img.src).height}
                  loading="lazy"
                  pictureClassName="block w-full h-full"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}

      {viewer !== null && <Viewer images={images} start={viewer} onClose={closeViewer} />}
    </div>
  );
}

/* ------------------------------------------------------------------ viewer */

function Viewer({
  images,
  start,
  onClose,
}: {
  images: ProductImage[];
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
                  width={imageSize(img.src).width}
                  height={imageSize(img.src).height}
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

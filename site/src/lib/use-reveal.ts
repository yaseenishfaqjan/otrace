import { useEffect } from 'react';

/**
 * Adds `.in-view` to every `.reveal` as it enters the viewport.
 *
 * IntersectionObserver alone was not enough. After an instant scroll jump - an
 * anchor link, the back button restoring position, a reload mid-page - its
 * callback can stay pending: measured in Chrome, 0 of 6 on-screen sections had
 * revealed 7.5s after a jump, while a gradual scroll revealed them at once.
 * So a cheap rAF-throttled sweep backs it up, and anything already in view or
 * scrolled past is revealed immediately - a section above the viewport must
 * never be left blank for someone scrolling back up.
 *
 * Hiding itself is gated on html.js-reveal (set in main.tsx), so if this never
 * runs the content shows rather than vanishing.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const pending = new Set<Element>(document.querySelectorAll('.reveal:not(.in-view)'));
    if (!pending.size) return;

    let io: IntersectionObserver | null = null;

    const show = (el: Element) => {
      el.classList.add('in-view');
      pending.delete(el);
      io?.unobserve(el);
    };

    const sweep = () => {
      const limit = window.innerHeight * 0.92;
      pending.forEach((el) => {
        if (el.getBoundingClientRect().top < limit) show(el);
      });
    };

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) show(e.target); }),
        { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
      );
      pending.forEach((el) => io!.observe(el));
    }

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sweep();
      });
    };

    sweep();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      io?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

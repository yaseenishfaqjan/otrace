import { flushSync } from 'react-dom';
import type { RouterProps } from 'wouter';

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/**
 * Wraps every in-app navigation in a View Transition.
 *
 * wouter calls this for each navigate (links included). The browser snapshots
 * the old page, we render the new one INSIDE the callback — flushSync, so the
 * DOM is actually updated before the callback returns and the browser snapshots
 * the new state — and CSS in index.css animates between the two.
 *
 * Falls straight back to a normal navigation where the API is missing or the
 * visitor has asked their device to reduce motion.
 */
export const aroundNav: NonNullable<RouterProps['aroundNav']> = (navigate, to, options) => {
  const doc = document as TransitionDocument;
  const animate =
    typeof doc.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!animate) {
    navigate(to, options);
    return;
  }

  doc.startViewTransition!(() => {
    flushSync(() => navigate(to, options));
  });
};

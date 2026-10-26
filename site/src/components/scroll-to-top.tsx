import { useLayoutEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * A client-side router keeps the scroll position between routes, so tapping a
 * product from halfway down the grid lands you halfway down the product page.
 */
export function ScrollToTop() {
  const [location] = useLocation();
  // Layout effect, not a passive one: it runs inside the page transition's
  // synchronous commit, so the browser snapshots the new page already at the
  // top. A passive effect scrolled AFTER the snapshot and the page jumped.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location]);
  return null;
}

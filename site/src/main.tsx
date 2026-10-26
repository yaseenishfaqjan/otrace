import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Router } from 'wouter';
import App from '@/App';
import { aroundNav } from '@/lib/view-transition';
import '@/index.css';

// Opt in to reveal-on-scroll hiding only once JavaScript is actually running,
// and before the first paint so below-the-fold sections never flash.
document.documentElement.classList.add('js-reveal');

const app = (
  <StrictMode>
    {/* aroundNav wraps every navigation in a View Transition. */}
    <Router aroundNav={aroundNav}>
      <App />
    </Router>
  </StrictMode>
);

// Prerendered pages (scripts/prerender.mjs) already contain the markup: hydrate
// it in place so the images and text that painted first stay the same nodes.
// createRoot would throw that markup away and paint it again, which pushed
// Largest Contentful Paint back by seconds on a throttled phone.
const container = document.getElementById('root')!;
if (document.documentElement.hasAttribute('data-prerendered') && container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}

import { useEffect } from 'react';

/**
 * Canonical origin. Set VITE_SITE_URL at build time if the live domain differs;
 * every canonical link, share URL, sitemap entry and structured-data URL
 * derives from it.
 */
export const SITE_URL = (
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SITE_URL ?? 'https://otrace.co'
).replace(/\/$/, '');

export const SITE_NAME = 'OTRACE';
export const DEFAULT_TITLE = 'OTRACE — Heavyweight Oversized Hoodies & Wide-Leg Sweatpants';
export const DEFAULT_DESCRIPTION =
  'OTRACE AW2026: 450 GSM heavyweight fleece hoodies and wide-leg sweatpants, cut oversized and garment dyed in Onyx Black and Warm Cream. In stock, free US shipping.';
export const DEFAULT_IMAGE = '/og.jpg';

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`);

type Options = {
  /** Keep the page out of search results (cart, account, order confirmation, 404). */
  noindex?: boolean;
  /** Share image path or URL; defaults to /og.jpg. */
  image?: string;
  type?: 'website' | 'product';
  /** Structured data for this page (schema.org JSON-LD). */
  jsonLd?: object | object[];
};

/** Markdown mirrors served next to these HTML routes (llmstxt.org v2). */
const MARKDOWN_BY_PATH: Record<string, string> = {
  '/': '/index.md',
  '/about': '/about.md',
  '/sizing': '/sizing.md',
  '/garment-dyed': '/garment-dyed.md',
  '/shipping': '/shipping.md',
  '/product/oversized-hoodie': '/product/oversized-hoodie.md',
  '/product/wide-leg-sweatpant': '/product/wide-leg-sweatpant.md',
};

function syncDiscoveryLinks(pathname: string) {
  document.head.querySelectorAll('link[data-discovery]').forEach((el) => el.remove());
  const described = document.createElement('link');
  described.rel = 'describedby';
  described.href = absoluteUrl('/llms.txt');
  described.dataset.discovery = '';
  document.head.appendChild(described);
  const md = MARKDOWN_BY_PATH[pathname];
  if (!md) return;
  const alt = document.createElement('link');
  alt.rel = 'alternate';
  alt.type = 'text/markdown';
  alt.href = absoluteUrl(md);
  alt.dataset.discovery = '';
  document.head.appendChild(alt);
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Per-page title, description, canonical URL, share tags, robots and JSON-LD.
 *
 * Runs in the browser; the build's prerender step (scripts/prerender.mjs)
 * snapshots the result into static HTML so crawlers and link previews get the
 * same tags without running JavaScript.
 *
 * Parents' effects run after their children's, so a page that falls back to
 * <NotFound /> must pass its own "Page not found" title or it overwrites the
 * child's.
 */
export function usePageMeta(title?: string, description: string = DEFAULT_DESCRIPTION, options: Options = {}) {
  const { noindex = false, image = DEFAULT_IMAGE, type = 'website', jsonLd } = options;
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE;
    const pathname = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/$/, '');
    const url = absoluteUrl(pathname);
    const img = absoluteUrl(image);

    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    syncDiscoveryLinks(pathname);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', img);

    document.head.querySelector('script[data-page-ld]')?.remove();
    if (ld) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.pageLd = '';
      script.textContent = ld;
      document.head.appendChild(script);
    }
  }, [title, description, noindex, image, type, ld]);
}

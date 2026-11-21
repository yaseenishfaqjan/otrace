/**
 * Public routes that used to live only on the React storefront.
 * Nginx sends the same paths here. The theme renderer draws the HTML.
 */
import { loadVerifiedPurchase, readCookie, sendMetaPurchase } from './ads.js';
import { clearThemeCart } from './cart.js';
import { publicBody } from './discovery.js';
import { PRODUCTS } from '../catalog.js';
import { searchProducts } from './search.js';
import { findPost, journalBlurb, journalIndexHtml, journalPostHtml } from './journal.js';
import { notFoundPage, pageContent, questionFaqs, standalonePage } from './pages.js';
import { blogIndexLd, blogPostLd, breadcrumbLd, faqLd, setLd, speakableLd } from './seo.js';

/**
 * The search query is the only user-controlled string that reaches a rendered
 * page here, and it lands in the <title>. Escape it at the boundary rather
 * than trusting the renderer to do it.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export async function sendNotFound(res, { themeRenderer, sendThemeHtml }) {
  if (!themeRenderer) return res.status(404).type('text').send('No such page.');
  const page = notFoundPage();
  try {
    const html = await themeRenderer.renderPage('page', page, 'page');
    res.status(404);
    sendThemeHtml(res, html, { noindex: true });
  } catch (err) {
    console.error('[theme] 404 render failed:', err.message);
    res.status(404).type('text').send('No such page.');
  }
}

export function mountStorefront(app, {
  themeRenderer,
  sendThemeHtml,
  siteUrl,
  stripe = null,
  onVerifiedSession = null,
}) {
  const missing = (res) => sendNotFound(res, { themeRenderer, sendThemeHtml });
  const renderStandalone = async (res, kind, ads) => {
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    const page = standalonePage(kind);
    if (!page) return res.status(404).send('No such page.');
    const json_ld = kind === 'complete-set'
      ? [setLd(siteUrl), breadcrumbLd(siteUrl, [
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        { name: 'Complete set', path: '/product/complete-set' },
      ])]
      : null;
    try {
      const html = await themeRenderer.renderPage('page', {
        ...page,
        json_ld,
        ...(ads ? { ads } : {}),
      }, 'page');
      sendThemeHtml(res, html, { noindex: page.noindex });
    } catch (err) {
      console.error(`[theme] ${kind} render failed:`, err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  };

  app.get(['/api/theme-preview/not-found'], (req, res) => missing(res));

  app.get(['/api/theme-preview/blog', '/blog'], async (req, res) => {
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    try {
      const html = await themeRenderer.renderPage('page', {
        title: 'Journal',
        page_title: 'Journal: Heavyweight Fleece, Fit & Garment Dye — OTRACE',
        page_description: journalBlurb,
        content: journalIndexHtml(),
        handle: 'blog',
        canonical_path: '/blog',
        json_ld: [
          blogIndexLd(siteUrl),
          breadcrumbLd(siteUrl, [
            { name: 'Home', path: '/' },
            { name: 'Journal', path: '/blog' },
          ]),
        ],
      }, 'page');
      sendThemeHtml(res, html);
    } catch (err) {
      console.error('[theme] blog render failed:', err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  });

  app.get(['/api/theme-preview/blog/:slug', '/blog/:slug'], async (req, res, next) => {
    if (String(req.params.slug).endsWith('.md')) return next();
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    const post = findPost(req.params.slug);
    if (!post) return missing(res);
    try {
      const html = await themeRenderer.renderPage('page', {
        title: post.h1,
        page_title: `${post.h1} — OTRACE`,
        page_description: post.description,
        content: journalPostHtml(post),
        handle: post.slug,
        canonical_path: `/blog/${post.slug}`,
        json_ld: [
          blogPostLd(post, siteUrl),
          questionFaqs(post.sections).length ? faqLd(questionFaqs(post.sections)) : null,
          breadcrumbLd(siteUrl, [
            { name: 'Home', path: '/' },
            { name: 'Journal', path: '/blog' },
            { name: post.h1, path: `/blog/${post.slug}` },
          ]),
          speakableLd(siteUrl, `/blog/${post.slug}`),
        ],
      }, 'article');
      sendThemeHtml(res, html);
    } catch (err) {
      console.error('[theme] article render failed:', err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  });

  app.get(['/api/theme-preview/order/success', '/order/success'], async (req, res) => {
    clearThemeCart(req, res);
    const loaded = await loadVerifiedPurchase(stripe, req.query.session_id);
    const purchase = loaded.purchase;
    if (purchase) {
      const origin = String(siteUrl || '').replace(/\/$/, '');
      try {
        await sendMetaPurchase(purchase, {
          eventSourceUrl: `${origin}/order/success?session_id=${encodeURIComponent(purchase.transaction_id)}`,
          email: loaded.email,
          clientIp: req.get('x-forwarded-for') || req.ip,
          userAgent: req.get('user-agent'),
          fbp: readCookie(req.headers.cookie, '_fbp'),
          fbc: readCookie(req.headers.cookie, '_fbc'),
        });
      } catch (err) {
        console.warn('[ads] capi failed:', err.message);
      }
    }
    if (loaded.purchase && loaded.session && typeof onVerifiedSession === 'function') {
      try {
        await onVerifiedSession(loaded.session);
      } catch (err) {
        console.warn('[order] could not save the paid session:', err.message);
      }
    }
    await renderStandalone(res, 'order-success', purchase ? { purchase } : null);
  });

  app.get([
    '/api/theme-preview/account',
    '/api/theme-preview/account/login',
    '/api/theme-preview/account/register',
    '/account',
    '/account/login',
    '/account/register',
  ], (req, res) => renderStandalone(res, 'account'));

  app.get(['/api/theme-preview/product/complete-set', '/product/complete-set'], (req, res) => {
    renderStandalone(res, 'complete-set');
  });

  // /complete-set used to fall through to the homepage. The product URL is canonical.
  app.get(['/complete-set', '/complete-set/', '/api/theme-preview/complete-set'], (req, res) => {
    res.redirect(301, '/product/complete-set');
  });
  app.get(['/complete-set.md', '/api/theme-preview/complete-set.md'], (req, res) => {
    res.redirect(301, '/product/complete-set.md');
  });

  /**
   * /lookbook/ is not the page route nginx's regex would have rewritten.
   *
   * The photo prefix `location ^~ /lookbook/` wins over the page regex, so a
   * trailing slash is proxied here unchanged and Express answers "Cannot GET
   * /lookbook/". The page and the photo files share that prefix: this route is
   * only the bare directory, and the file middleware below still serves
   * /lookbook/look-10-tall.jpg. Nav links stay /lookbook, which this also serves.
   */
  const renderLookbook = async (res) => {
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    const page = pageContent('lookbook');
    if (!page) return res.status(404).send('No such page.');
    try {
      sendThemeHtml(res, await themeRenderer.renderPage('page', page, 'page'));
    } catch (err) {
      console.error('[theme] lookbook render failed:', err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  };
  app.get(['/lookbook', '/lookbook/'], (req, res) => renderLookbook(res));

  /**
    * A real results page. This threw the query away and 302'd to /shop, so a
    * shopper who searched "sweatpants" landed on the whole catalogue with
    * nothing to say their search had been read - and a search that genuinely
    * matched nothing looked identical to one that matched everything.
    *
    * noindex: a results page is not a page we want in the index, and an
    * indexable one invites a crawler to enumerate query strings.
    */
  const searchPage = async (req, res) => {
    if (req.query.view === 'wishlist') return renderStandalone(res, 'wishlist');
    const query = String(req.query.q ?? '').slice(0, 80).trim();
    if (!query) return res.redirect(302, '/shop');
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');

    const hits = searchProducts(query);
    // The Complete Set is a page, not a row in PRODUCTS, so it has no card to
    // render. It IS both garments, so a match on it shows both rather than an
    // empty page - "tracksuit" matches only the set and must not look like a
    // miss.
    const products = [];
    for (const hit of hits) {
      for (const product of hit.product ? [hit.product] : Object.values(PRODUCTS)) {
        if (!products.includes(product)) products.push(product);
      }
    }

    try {
      sendThemeHtml(res, await themeRenderer.renderCollection({
        handle: 'search',
        title: products.length
          ? `Results for “${escapeHtml(query)}”`
          : `No results for “${escapeHtml(query)}”`,
        description: products.length
          ? 'Every OTRACE piece is 450 GSM garment-dyed heavyweight fleece.'
          : 'Nothing matched that. AW2026 is an oversized hoodie and a wide-leg sweatpant, in Onyx Black and Warm Cream.',
        products,
        // /search is not a collection URL. Canonical to /shop so the shelf
        // this page is a view of is what gets indexed, and noindex so the
        // markup agrees with the header rather than contradicting it.
        canonicalPath: '/shop',
        noindex: true,
      }), { noindex: true });
    } catch (err) {
      console.error('[theme] search render failed:', err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  };
  app.get(['/api/theme-preview/search', '/search'], searchPage);
  app.get(['/api/theme-preview/search/', '/search/'], searchPage);

  app.get(['/api/theme-preview/search/suggest', '/search/suggest'], (req, res) => {
    const id = String(req.query.section_id || 'predictive-search').replace(/[^a-zA-Z0-9_-]/g, '') || 'predictive-search';
    const q = String(req.query.q || '').slice(0, 80);
    // Same index as the results page. Two matchers would eventually disagree,
    // and the dropdown saying "No matches" over a page that lists two is the
    // version of that nobody would report.
    const hits = searchProducts(q);
    const list = hits
      .map(({ label, href }) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
      .join('');
    res.type('html').send(
      `<div id="shopify-section-${id}"><div class="hdt-search-suggests-results">${list || '<p>No matches.</p>'}</div></div>`,
    );
  });

  app.get('/api/theme-preview/browsing_context_suggestions.json', (_req, res) => {
    res.json({ detected_values: { country: { handle: 'US', name: 'United States' } } });
  });

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const hit = publicBody(req.path, siteUrl);
    if (!hit) return next();
    if (hit.file) return res.sendFile(hit.file, (err) => (err ? next() : undefined));
    res.set('X-Otrace-Public', 'theme');
    if (String(hit.type).includes('markdown')) {
      res.set('Link', '</llms.txt>; rel="describedby"');
      // These are the HTML pages restated for AI crawlers, so indexing one is
      // duplicate content against the page it describes. Bing had about.md in
      // the index as a page in its own right - measured in Site Explorer,
      // 15 Nov 2026, where it sat beside /about among only six indexed URLs.
      res.set('X-Robots-Tag', 'noindex');
    }
    res.status(200).type(hit.type).send(hit.body);
  });

  // Kept so a direct import of pageContent in tests is not the only caller.
  return { pageContent };
}

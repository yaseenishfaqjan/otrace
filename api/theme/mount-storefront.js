/**
 * Public routes that used to live only on the React storefront.
 * Nginx sends the same paths here. The theme renderer draws the HTML.
 */
import { clearThemeCart } from './cart.js';
import { publicBody } from './discovery.js';
import { findPost, journalBlurb, journalIndexHtml, journalPostHtml } from './journal.js';
import { pageContent, standalonePage } from './pages.js';
import { blogIndexLd, blogPostLd, breadcrumbLd, setLd } from './seo.js';

export function mountStorefront(app, { themeRenderer, sendThemeHtml, siteUrl }) {
  const renderStandalone = async (res, kind) => {
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
      const html = await themeRenderer.renderPage('page', { ...page, json_ld }, 'page');
      sendThemeHtml(res, html, { noindex: page.noindex });
    } catch (err) {
      console.error(`[theme] ${kind} render failed:`, err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  };

  app.get(['/api/theme-preview/blog', '/blog'], async (req, res) => {
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    try {
      const html = await themeRenderer.renderPage('page', {
        title: 'Journal',
        page_title: 'Journal — OTRACE',
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
    if (!post) return res.status(404).send('No such note.');
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
          breadcrumbLd(siteUrl, [
            { name: 'Home', path: '/' },
            { name: 'Journal', path: '/blog' },
            { name: post.h1, path: `/blog/${post.slug}` },
          ]),
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
    await renderStandalone(res, 'order-success');
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

  const searchPage = async (req, res) => {
    if (req.query.view === 'wishlist') return renderStandalone(res, 'wishlist');
    res.redirect(302, '/shop');
  };
  app.get(['/api/theme-preview/search', '/search'], searchPage);
  app.get(['/api/theme-preview/search/', '/search/'], searchPage);

  app.get(['/api/theme-preview/search/suggest', '/search/suggest'], (req, res) => {
    const id = String(req.query.section_id || 'predictive-search').replace(/[^a-zA-Z0-9_-]/g, '') || 'predictive-search';
    const q = String(req.query.q || '').slice(0, 80);
    const wanted = q.toLowerCase();
    const hits = [
      ['Oversized Hoodie', '/product/oversized-hoodie'],
      ['Wide-Leg Sweatpant', '/product/wide-leg-sweatpant'],
      ['Complete set', '/product/complete-set'],
    ].filter(([label]) => !wanted || label.toLowerCase().includes(wanted));
    const list = hits.map(([label, href]) => `<a href="${href}">${label}</a>`).join('');
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
    }
    res.status(200).type(hit.type).send(hit.body);
  });

  // Kept so a direct import of pageContent in tests is not the only caller.
  return { pageContent };
}

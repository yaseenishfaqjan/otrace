/**
 * HTTP surface for the theme cart.
 *
 * Every read and write goes through attachCart, which mints a per-browser id
 * and refuses the old shared token. Responses are private so a cache cannot
 * replay one visitor's basket to the next.
 */
import { formatMoney } from '../catalog.js';
import { rawBodyFor } from './form-body.js';
import {
  addLine,
  applyUpdates,
  attachCart,
  cartJson,
  changeLine,
  decodeVariantId,
} from './cart.js';

const ROOT = '/api/theme-preview';

const privateCart = (res) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Cookie');
};

/** Section ids the theme asked to re-render, from a JSON body or a form field. */
const requestedSections = (body) => {
  const raw = body?.sections ?? body?.section_id;
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const ids = list.map((id) => String(id).trim()).filter(Boolean);
  // The drawer always reads sections["cart-drawer"]. Include it when the
  // caller did not name one, so an add still refreshes the basket.
  if (!ids.length) ids.push('cart-drawer');
  return ids;
};

const cartWantsJson = (req) => {
  if (/xmlhttprequest/i.test(String(req.get('x-requested-with') || ''))) return true;
  if (String(req.headers['content-type'] || '').includes('application/json')) return true;
  if (String(req.headers.accept || '').includes('application/json')) return true;
  return req.body?.sections != null;
};

export function mountCartRoutes(app, {
  store,
  siteUrl,
  routesRoot = '/api/theme-preview/',
  themeRenderer = null,
  sendThemeHtml,
  createCheckoutSession,
  stripe,
}) {
  const sectionsFor = async (req, cart) => {
    if (!themeRenderer?.renderCartSections) return {};
    try {
      return await themeRenderer.renderCartSections(cart, requestedSections(req.body));
    } catch (err) {
      console.error('[theme] cart sections failed:', err.message);
      return {};
    }
  };

  const sendCart = async (req, res, id, lines) => {
    store.set(id, lines);
    const stored = store.get(id);
    privateCart(res);
    // A no-JS product form posts here and expects a page, not JSON.
    if (!cartWantsJson(req)) return res.redirect(303, '/cart');
    const cart = cartJson(stored, { siteUrl, token: id });
    const sections = await sectionsFor(req, cart);
    res.json({ ...cart, sections });
  };

  app.get(`${ROOT}/cart.js`, (req, res) => {
    const { id, lines } = attachCart(req, res, store);
    privateCart(res);
    res.json(cartJson(lines, { siteUrl, token: id }));
  });

  app.post(`${ROOT}/cart/add.js`, rawBodyFor(), async (req, res) => {
    const { id, lines: start } = attachCart(req, res, store);
    const body = req.body || {};
    // Shopify accepts one item or an items[] array; the theme sends both shapes.
    const incoming = Array.isArray(body.items) ? body.items : [body];
    let lines = start;
    for (const item of incoming) {
      const decoded = decodeVariantId(item.id ?? item.variant_id);
      if (!decoded) {
        privateCart(res);
        return res.status(422).json({ status: 422, message: 'Cannot find variant' });
      }
      const quantity = Math.min(10, Math.max(1, Number.parseInt(item.quantity, 10) || 1));
      lines = addLine(lines, { ...decoded, quantity });
    }
    await sendCart(req, res, id, lines);
  });

  app.post(`${ROOT}/cart/change.js`, rawBodyFor(), async (req, res) => {
    const { id, lines } = attachCart(req, res, store);
    const body = req.body || {};
    const quantity = Math.min(10, Math.max(0, Number.parseInt(body.quantity, 10) || 0));
    await sendCart(req, res, id, changeLine(lines, body.id ?? body.line, quantity));
  });

  // The remove link is a plain GET: /cart/change?line=1&quantity=0.
  app.get(`${ROOT}/cart/change`, (req, res) => {
    const { id, lines } = attachCart(req, res, store);
    const quantity = Math.min(10, Math.max(0, Number.parseInt(req.query.quantity, 10) || 0));
    store.set(id, changeLine(lines, req.query.id ?? req.query.line, quantity));
    privateCart(res);
    res.redirect(303, '/cart');
  });

  app.post(`${ROOT}/cart/update.js`, rawBodyFor(), async (req, res) => {
    const { id, lines } = attachCart(req, res, store);
    const updates = (req.body || {}).updates;
    const next = updates == null ? lines : applyUpdates(lines, updates);
    await sendCart(req, res, id, next);
  });

  app.get(`${ROOT}/cart`, async (req, res) => {
    if (!themeRenderer) return res.status(503).send('Theme preview is not available.');
    const { id, lines } = attachCart(req, res, store);
    privateCart(res);
    try {
      sendThemeHtml(res, await themeRenderer.renderPage('cart', {
        cart: cartJson(lines, { siteUrl, token: id }),
        title: 'Your cart',
        page_title: 'Your cart — OTRACE',
        noindex: true,
        canonical_path: '/cart',
      }), { noindex: true });
    } catch (err) {
      console.error('[theme] cart render failed:', err.message);
      res.status(500).send('Theme render failed: ' + err.message);
    }
  });

  /**
   * The theme's cart form posts here.
   *
   * Shopify's /cart accepts a POST from the cart form and, when the submit
   * button is named "checkout", sends the customer on to the payment page. The
   * form is a plain POST and not fetch(), so the answer has to be a redirect -
   * returning JSON here leaves the customer looking at raw JSON.
   *
   * Quantities in the form (`updates[]`) are applied first, including when the
   * button is checkout, so Stripe is charged for the lines this visitor sees.
   */
  app.post(`${ROOT}/cart`, rawBodyFor(), async (req, res) => {
    const { id, lines: start } = attachCart(req, res, store);
    const body = req.body || {};
    const lines = body.updates == null ? start : applyUpdates(start, body.updates);
    store.set(id, lines);
    const stored = store.get(id);
    privateCart(res);
    const wantsCheckout = Object.prototype.hasOwnProperty.call(body, 'checkout');

    if (!wantsCheckout) {
      return res.redirect(303, routesRoot + 'cart');
    }

    try {
      const { session, error } = await createCheckoutSession(stripe, stored, { siteUrl });
      if (error) {
        console.warn('[theme checkout] refused:', error);
        return res.status(400).send(error);
      }
      console.log(`[theme checkout] session ${session.id} for ${formatMoney(session.amount_total ?? 0)}`);
      res.redirect(303, session.url);
    } catch (err) {
      console.error('[theme checkout] failed:', err.message);
      res.status(500).send('Checkout could not start. Please try again.');
    }
  });
}

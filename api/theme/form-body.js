/**
 * Read a Shopify-style cart POST body.
 *
 * The theme submits with `new FormData(form)`, which the browser sends as
 * multipart/form-data - so a JSON-only handler rejects every real add-to-cart
 * while curl with a JSON body works perfectly. Shopify's own endpoint accepts
 * multipart, urlencoded and JSON, so this does too.
 *
 * Only TEXT fields are read. Nothing here ever uploads a file, and refusing to
 * buffer one is the point rather than a limitation.
 */
const FIELD_LIMIT = 64;
const VALUE_LIMIT = 1024;

const parseMultipart = (raw, boundary) => {
  const out = {};
  const parts = raw.split('--' + boundary);
  for (const part of parts) {
    const split = part.indexOf('\r\n\r\n');
    if (split === -1) continue;
    const headers = part.slice(0, split);
    const name = /name="([^"]*)"/.exec(headers)?.[1];
    if (!name || /filename="/.test(headers)) continue;
    // The body runs to the CRLF that precedes the next boundary.
    const value = part.slice(split + 4).replace(/\r\n$/, '');
    if (Object.keys(out).length >= FIELD_LIMIT) break;
    out[name] = value.slice(0, VALUE_LIMIT);
  }
  return out;
};

const parseUrlEncoded = (raw) => {
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) {
    if (Object.keys(out).length >= FIELD_LIMIT) break;
    out[k] = String(v).slice(0, VALUE_LIMIT);
  }
  return out;
};

/** Parse a raw body string against its Content-Type. Never throws. */
export function parseFormBody(raw, contentType = '') {
  const type = String(contentType);
  try {
    if (type.includes('multipart/form-data')) {
      const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
      const value = boundary && (boundary[1] || boundary[2]);
      return value ? parseMultipart(String(raw), value.trim()) : {};
    }
    if (type.includes('application/x-www-form-urlencoded')) return parseUrlEncoded(String(raw));
    return JSON.parse(String(raw) || '{}');
  } catch {
    // A body we cannot read is an empty one; the caller answers 422 with a
    // message rather than throwing a 500 at the customer.
    return {};
  }
}

/**
 * Express middleware: buffer the raw body for the cart routes only.
 *
 * express.json() is mounted first and consumes application/json. The cart
 * quantity and remove controls post JSON (`cart/change.js`, `cart/update.js`).
 * Listening for `end` after that parser has already finished never fires, so
 * the request sits open until nginx answers 504. A body that is already an
 * object is that parsed JSON; use it and do not read the stream again.
 */
export const rawBodyFor = (limitBytes = 64 * 1024) => (req, res, next) => {
  const type = String(req.headers?.['content-type'] || '');
  const alreadyParsed =
    req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body);
  if (alreadyParsed && type.includes('application/json')) return next();
  if (req.readableEnded || req.complete) {
    const raw = typeof req.body === 'string' ? req.body : '';
    req.body = parseFormBody(raw, type);
    return next();
  }
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limitBytes) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    req.body = parseFormBody(Buffer.concat(chunks).toString('utf8'), req.headers['content-type']);
    next();
  });
  req.on('error', () => next());
};

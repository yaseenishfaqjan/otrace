/**
 * Product search.
 *
 * Measured against the live site on 22 Nov 2026: ELEVEN of fourteen queries a
 * shopper would actually type returned "No matches" - including `hoodies` and
 * `sweatpants`, the plurals of the only two products, and `wide leg`, which is
 * in a product's own name. Also dead: `onyx`, `warm cream`, `450 gsm`,
 * `fleece`, `joggers`, `bottoms`.
 *
 * The matcher was `label.toLowerCase().includes(query)` over three hard-coded
 * titles, so a trailing s missed, a hyphen missed, and nothing about colour or
 * fabric was searchable at all. On a two-product store, being told there is no
 * hoodie when you search "hoodies" is the worst version of this.
 *
 * The document is built FROM the catalogue - name, seoTitle, slug, description,
 * colours, sizes - so renaming a product cannot leave a stale keyword behind.
 * The only hand-written part is SYNONYMS, and it deliberately holds just the
 * words the catalogue does not contain anywhere: what people call these clothes
 * when they are not reading our copy.
 */
import { PRODUCTS } from '../catalog.js';

/** Words shoppers use that appear nowhere in the catalogue. */
const SYNONYMS = {
  'OT-HOOD': ['hoody', 'hoodie', 'sweatshirt', 'sweater', 'jumper', 'pullover', 'hood', 'top'],
  'OT-PANT': ['jogger', 'sweatpant', 'trackpant', 'trouser', 'bottom', 'pant', 'sweats', 'lounge'],
};

/** True of every piece: the brand, the fabric story, the season. */
const SHARED = [
  'otrace', '450', 'gsm', 'fleece', 'heavyweight', 'garment', 'dyed', 'oversized',
  'streetwear', 'aw2026', 'unisex', 'cotton', 'loungewear',
];

/** The set is a real product page but not a row in PRODUCTS. */
const SET = {
  key: 'complete-set',
  label: 'Complete Set',
  href: '/product/complete-set',
  extra: ['set', 'complete', 'tracksuit', 'suit', 'bundle', 'outfit', 'matching', 'both', 'coord'],
};

export const words = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

/**
 * Crude singular. Only a trailing s, and only on a word long enough that
 * dropping it cannot destroy the word: `gsm` and `set` must survive intact,
 * while `hoodies`, `sweatpants` and `bottoms` must not.
 */
export const stem = (word) =>
  word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;

const tokenise = (value) => words(value).map(stem);

/** One searchable entry per thing a shopper can land on. */
export function buildIndex(products = PRODUCTS) {
  const entries = Object.values(products).map((product) => {
    const source = [
      product.name, product.seoTitle, product.slug, product.description,
      ...(product.colours ?? []), ...(product.sizes ?? []),
      ...(SYNONYMS[product.sku] ?? []), ...SHARED,
    ];
    return {
      key: product.slug,
      label: product.name.replace(/^OTRACE\s+/, ''),
      href: `/product/${product.slug}`,
      product,
      tokens: new Set(source.flatMap(tokenise)),
    };
  });

  entries.push({
    key: SET.key,
    label: SET.label,
    href: SET.href,
    product: null,
    tokens: new Set([...SET.extra, ...SHARED, ...Object.values(products)
      .flatMap((p) => [p.name, ...(p.colours ?? [])])].flatMap(tokenise)),
  });

  return entries;
}

/**
 * Every query token must match the start of some token on the entry.
 *
 * Prefix, not equality, so `sweat` reaches `sweatpant` and `black` reaches
 * `black`. ALL tokens must match, so "warm cream hoodie" narrows rather than
 * widening - an any-token match would return the whole catalogue for every
 * two-word query and read as if search were ignoring you.
 */
const MIN_LOOSE = 3;

const matches = (entry, queryTokens) =>
  queryTokens.every((q) => {
    for (const t of entry.tokens) {
      // The query is a prefix of the token: "sweat" reaches "sweatpant".
      if (t.startsWith(q)) return true;
      // The token is a prefix of the query: "hood" reaches "hoodies". Only
      // for tokens of real length - the index carries the SIZES, so a
      // one-letter `s` would otherwise make every query beginning with s
      // match every product. It did: "sweatpant" returned the hoodie.
      if (t.length >= MIN_LOOSE && q.startsWith(t)) return true;
    }
    return false;
  });

/** Ranked hits. An empty query returns everything, which is the shop. */
export function searchProducts(query, products = PRODUCTS) {
  const index = buildIndex(products);
  const queryTokens = tokenise(query);
  if (!queryTokens.length) return index;

  return index
    .filter((entry) => matches(entry, queryTokens))
    .map((entry) => {
      // A hit in the visible label beats one in the description or a synonym,
      // so "hoodie" puts the Oversized Hoodie above the Complete Set.
      const label = new Set(tokenise(entry.label));
      const score = queryTokens.filter((q) => [...label].some((t) => t.startsWith(q))).length;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score || a.entry.key.localeCompare(b.entry.key))
    .map(({ entry }) => entry);
}

/**
 * OTRACE AW2026 — storefront catalogue.
 *
 * Prices here are for DISPLAY ONLY. api/catalog.js holds the authoritative
 * price and never trusts anything the browser sends, so a tampered bundle
 * cannot change what Stripe charges. If you edit a price here, edit
 * api/catalog.js in the same commit or the customer sees one number and is
 * charged another.
 */

export type ProductImage = {
  src: string;
  label: string;
  alt: string;
};

export type Colorway = {
  /** Must match a value in the server catalogue's `colours` exactly. */
  name: string;
  /** Swatch fill — the actual garment colour. */
  hex: string;
  /** A cream swatch on a near-black page needs no ring; a black one does. */
  images: ProductImage[];
};

export type Product = {
  slug: string;
  sku: string;
  name: string;
  /** Short descriptor shown under the name on cards. */
  line: string;
  price: number;
  /** Before the offer. Shown struck through; api/catalog.js is the authority. */
  listPrice: number;
  category: string;
  categorySlug: string;
  /** One sentence with a point of view, not a spec dump. */
  tagline: string;
  details: string[];
  fabric: string;
  fit: string;
  care: string;
  colorways: Colorway[];
  /**
   * Present only while a piece is sold ahead of production. Absent means it is
   * in stock and ships on the normal window — so a future in-stock drop needs
   * no code change, only data.
   */
  preorder?: { shipsIn: string };
};

/** Normal despatch window for anything held in stock. */
export const IN_STOCK_SHIPS_IN = '3–5 business days';

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export type Size = (typeof SIZES)[number];

/**
 * Shipping shown to the customer. Display only — the server decides what
 * Stripe actually charges and enforces the threshold on its own count.
 */
export const SHIPPING = {
  cost: 0,
  freeFromQuantity: 1,
};

export const shippingFor = (_units: number) => SHIPPING.cost;

export const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export type Category = {
  slug: string;
  name: string;
  blurb: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: 'hoodies',
    name: 'Hoodies',
    blurb:
      'Boxy through the body, dropped at the shoulder, cut long enough to sit where it should. 450 GSM and garment dyed.',
  },
  {
    slug: 'bottoms',
    name: 'Bottoms',
    blurb:
      'Wide through the leg with a ribbed ankle that stacks. Built from the same fleece as the hoodie so the set reads as one piece.',
  },
];

export const getCategory = (slug: string | undefined) =>
  slug ? CATEGORIES.find((c) => c.slug === slug) : undefined;

export const PRODUCTS: Product[] = [
  {
    slug: 'oversized-hoodie',
    sku: 'OT-HOOD',
    name: 'Oversized Hoodie',
    line: 'Heavyweight fleece — AW2026',
    price: 148,
    listPrice: 148,
    category: 'Hoodies',
    categorySlug: 'hoodies',
    tagline:
      'The anchor of the collection. Cut boxy, dropped at the shoulder, and dyed after it is sewn so no two land exactly the same.',
    details: [
      'Boxy oversized body with a dropped shoulder seam',
      'Self-lined double-layer hood',
      'Split kangaroo pocket',
      'White moulded plastic drawcord tips through metal eyelets',
      'Ribbed cuffs and hem that hold their shape',
      'OTRACE wordmark embroidered at the chest in 40wt matte thread',
    ],
    fabric: '450 GSM heavyweight fleece. 100% cotton, pre-shrunk, garment dyed.',
    fit: 'Oversized. Take your usual size for the intended fit, or size down for a cleaner line.',
    care: 'Machine wash cold, inside out. Tumble dry low. Do not iron the embroidery.',
    colorways: [
      {
        name: 'Onyx Black',
        hex: '#0D0C0B',
        images: [
          { src: '/products/hoodie-onyx-front.jpg', label: 'Front', alt: 'OTRACE oversized hoodie in Onyx Black, front' },
          { src: '/products/hoodie-onyx-back.jpg', label: 'Back', alt: 'OTRACE oversized hoodie in Onyx Black, back' },
          { src: '/products/hoodie-onyx-worn-front.jpg', label: 'Worn', alt: 'Model wearing the OTRACE oversized hoodie in Onyx Black' },
          { src: '/products/hoodie-onyx-worn-back.jpg', label: 'Worn back', alt: 'Model wearing the OTRACE oversized hoodie in Onyx Black, from behind' },
        ],
      },
      {
        name: 'Warm Cream',
        hex: '#F0EBE0',
        images: [
          { src: '/products/hoodie-cream-front.jpg', label: 'Front', alt: 'OTRACE oversized hoodie in Warm Cream, front' },
          { src: '/products/hoodie-cream-back.jpg', label: 'Back', alt: 'OTRACE oversized hoodie in Warm Cream, back' },
          { src: '/products/hoodie-cream-worn-front.jpg', label: 'Worn', alt: 'Model wearing the OTRACE oversized hoodie in Warm Cream' },
          { src: '/products/hoodie-cream-worn-back.jpg', label: 'Worn back', alt: 'Model wearing the OTRACE oversized hoodie in Warm Cream, from behind' },
        ],
      },
    ],
  },
  {
    slug: 'wide-leg-sweatpant',
    sku: 'OT-PANT',
    name: 'Wide-Leg Sweatpant',
    line: 'Heavyweight fleece — AW2026',
    price: 128,
    listPrice: 128,
    category: 'Bottoms',
    categorySlug: 'bottoms',
    tagline:
      'Cut wide from the hip and left to break at the ankle. The other half of the set, in the same dye lot.',
    details: [
      'Relaxed wide leg with a high rise',
      'Drawcord waist with white moulded plastic tips',
      'Ribbed ankle cuff built to stack',
      'Side seam pockets',
      'OTRACE monogram embroidered at the thigh',
      'Cut from the same 450 GSM fleece as the hoodie',
    ],
    fabric: '450 GSM heavyweight fleece. 100% cotton, pre-shrunk, garment dyed.',
    fit: 'Relaxed and wide. True to size at the waist.',
    care: 'Machine wash cold, inside out. Tumble dry low.',
    colorways: [
      {
        name: 'Onyx Black',
        hex: '#0D0C0B',
        images: [
          { src: '/products/pant-onyx-front.jpg', label: 'Front', alt: 'OTRACE wide-leg sweatpant in Onyx Black, front' },
          { src: '/products/pant-onyx-back.jpg', label: 'Back', alt: 'OTRACE wide-leg sweatpant in Onyx Black, back' },
          { src: '/products/pant-onyx-worn.jpg', label: 'Worn', alt: 'Model wearing the OTRACE wide-leg sweatpant in Onyx Black' },
        ],
      },
      {
        name: 'Warm Cream',
        hex: '#F0EBE0',
        images: [
          { src: '/products/pant-cream-front.jpg', label: 'Front', alt: 'OTRACE wide-leg sweatpant in Warm Cream, front' },
          { src: '/products/pant-cream-back.jpg', label: 'Back', alt: 'OTRACE wide-leg sweatpant in Warm Cream, back' },
          { src: '/products/pant-cream-worn.jpg', label: 'Worn', alt: 'Model wearing the OTRACE wide-leg sweatpant in Warm Cream' },
        ],
      },
    ],
  },
];

export const getProduct = (slug: string | undefined) =>
  slug ? PRODUCTS.find((p) => p.slug === slug) : undefined;

export const getProductBySku = (sku: string) => PRODUCTS.find((p) => p.sku === sku);

export const productsIn = (categorySlug: string) =>
  PRODUCTS.filter((p) => p.categorySlug === categorySlug);

/* ------------------------------------------------------------- size chart */

/**
 * Measurements are in centimetres, garment-flat.
 *
 * NOTE: taken from the AW2026 spec sheet. Four rows in that sheet run
 * backwards at L — chest 48→42, body length 68→66, inseam 77→73 — which would
 * have L smaller than M and drive returns. Those cells stay `null` here.
 * The sizing table estimates a single missing cell from the confirmed sizes
 * on either side and marks it estimated. A missing neighbor stays blank.
 */
export const SIZE_CHART: { label: string; values: (number | null)[] }[] = [
  { label: 'Chest', values: [40, 44, 48, null, 50, 53, 54] },
  { label: 'Body length', values: [62, 64, 68, null, 70, 72, 74] },
  { label: 'Shoulder', values: [15, 16, 17, 18, 19, 20, 21] },
  { label: 'Sleeve / waist', values: [26, 27, 28, 29, 30, 34, 35] },
  { label: 'Outseam', values: [76, 78, 80, 80, 82, 84, 86] },
  { label: 'Inseam', values: [76, 77, null, 75, 77, 78, 79] },
  { label: 'Leg opening', values: [10, 11, 12, 13, 14, 15, 16] },
];

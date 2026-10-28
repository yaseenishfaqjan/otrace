/**
 * Journal posts. The React pages and seo/build-discovery.mjs both read this
 * file, so the HTML and the markdown mirrors stay the same words.
 *
 * H1s are the autocomplete phrases that are not already a page title.
 * See seo/research/blog-queries.md.
 */
export const POSTS = [
  {
    slug: 'what-is-a-450-gsm-hoodie',
    h1: '450 GSM hoodie meaning',
    description:
      '450 GSM means the fleece weighs 450 grams per square metre. The OTRACE Oversized Hoodie is that weight: heavyweight cotton, brushed inside, garment dyed.',
    date: '2026-10-26',
    eyebrow: 'Fabric',
    answer:
      'A 450 GSM hoodie is cotton fleece weighing 450 grams for every square metre of cloth. GSM means grams per square metre. The OTRACE Oversized Hoodie is that weight: heavyweight loopback fleece, brushed on the inside, garment dyed.',
    hero: {
      src: '/detail-fabric.jpg',
      alt: 'Close view of the OTRACE 450 GSM loopback cotton fleece, brushed on the inside',
      caption: 'The inside of the OTRACE fleece. Loopback cotton, brushed, 450 GSM.',
    },
    diagram: 'gsm',
    sections: [
      {
        h2: 'What is a 450 GSM hoodie?',
        paragraphs: [
          'A 450 GSM hoodie is cotton fleece weighing 450 grams per square metre. The OTRACE Oversized Hoodie is that weight: heavyweight loopback fleece, brushed on the inside, garment dyed.',
          'GSM is a weight, not a size and not a fit. Cut one square metre of the cloth and weigh it. If the scale reads 450 grams, the cloth is 450 GSM. A heavier number is more fibre in that square, which is why the hoodie feels dense in the hand.',
          'There is no single public standard that grades 450 as a named class such as “ultra-heavyweight”. Brands use those words loosely. OTRACE publishes the grams. The Oversized Hoodie is 450 GSM heavyweight cotton fleece, the same figure on the product page and in the size of the knit.',
        ],
      },
      {
        h2: 'What this hoodie is made of',
        paragraphs: [
          'The fabric is 450 GSM heavyweight fleece, 100% cotton, pre-shrunk, garment dyed. It is loopback fleece, brushed on the inside. The face is the knit you see. The brush is the soft side against the body.',
          'It is cut boxy, with a dropped shoulder, a self-lined double-layer hood, a split kangaroo pocket, and white moulded plastic drawcord tips through metal eyelets. Ribbed cuffs and hem hold the edge. The OTRACE wordmark is embroidered at the chest. Wash it cold, inside out, and tumble dry low. High heat is what shrinks cotton hoodies, even when the cloth was pre-shrunk.',
        ],
        image: {
          src: '/detail-stitch.jpg',
          alt: 'Dropped shoulder seam on the OTRACE oversized hoodie after garment dyeing',
          caption: 'The shoulder seam after dyeing. The stitch and the body take the colour together.',
        },
      },
      {
        h2: 'The hoodie that uses it',
        paragraphs: [
          'The [Oversized Hoodie](/product/oversized-hoodie) is sold in Onyx Black and Warm Cream. The price on 26 October 2026 is 80 USD, reduced from 100 USD. Read the product page for the current price and for stock. The page is the source of truth, not this note.',
          'AW2026 is in stock. We ship worldwide. Delivery is free inside the United States, and in-stock orders ship in 3–5 business days. The same fleece is used for the [Wide-Leg Sweatpant](/product/wide-leg-sweatpant). One of each is the [complete set](/product/complete-set).',
          'Fit and the garment-flat measurements are on the [size chart](/sizing). How the dye is done is on [what garment dyed means](/garment-dyed). Both hoodies are in the [hoodies shop](/shop/hoodies).',
        ],
        image: {
          src: '/products/hoodie-onyx-worn-front.jpg',
          alt: 'OTRACE Oversized Hoodie in Onyx Black, flat lay front',
          caption: 'Oversized Hoodie, Onyx Black. The other colorway is Warm Cream.',
        },
      },
    ],
  },
  {
    slug: 'garment-dyed-vs-piece-dyed',
    h1: 'Garment dyed vs piece dyed',
    description:
      'Piece dyed means the fabric is dyed before it is cut and sewn. Garment dyed means the finished hoodie is dyed after sewing, so the seams take the colour too.',
    date: '2026-10-26',
    eyebrow: 'Dye',
    answer:
      'Piece dyed means the fabric is dyed before it is cut and sewn. Garment dyed means the finished piece is dyed after sewing, so seams and body take the dye together. OTRACE is garment dyed, and small variation between pieces is normal.',
    hero: {
      src: '/detail-stitch.jpg',
      alt: 'Seam on a garment-dyed OTRACE hoodie, with colour settled into the stitch',
      caption: 'A garment-dyed seam. The thread and the fleece went through the dye after sewing.',
    },
    diagram: 'dye',
    sections: [
      {
        h2: 'What is garment dyed versus piece dyed?',
        paragraphs: [
          'Piece dyed means the fabric is dyed before it is cut and sewn. Garment dyed means the finished piece is dyed after sewing, so seams and body take the dye together. OTRACE is garment dyed, and small variation between pieces is normal.',
          'Piece dyeing colours the cloth while it is still a roll. The roll is then cut into panels and sewn. The seam is made from cloth that was already coloured, so the stitch line often sits a different tone from the panels around it.',
          'Garment dyeing reverses that. The hoodie is knit, cut, and sewn in undyed fleece, and the finished piece goes into the dye. Hood, rib, pocket, and body take the bath together. That is why the colour settles into the seams instead of stopping at them.',
          'Yarn dyeing is a third order: the yarn is coloured before it is knit. OTRACE does not yarn-dye the AW2026 fleece. The short definition, including the sentence above, also lives on [what garment dyed means](/garment-dyed). This note is the comparison. That page keeps the question people type when they want the definition.',
        ],
      },
      {
        h2: 'A garment dyed hoodie, on this label',
        paragraphs: [
          'The [Oversized Hoodie](/product/oversized-hoodie) is a garment dyed hoodie in 450 GSM cotton fleece. So is the [Wide-Leg Sweatpant](/product/wide-leg-sweatpant), cut from the same cloth. The colorways are Onyx Black and Warm Cream. Two pieces from the same lot match. A later lot can sit a step lighter or darker. That shift is the process, not a fault, and the terms say the same thing.',
          'People also search “garment dyed hoodie” when they want to buy one. The product page is that page. This note does not replace it, and it does not set the price. The figure on 26 October 2026 is 80 USD for the hoodie and 80 USD for the sweatpant, each reduced from 100 USD, or 140 USD for both together as the [complete set](/product/complete-set). Check the live pages before you quote either number. Both are in the [shop](/shop). The [size chart](/sizing) is separate from this comparison.',
        ],
        image: {
          src: '/products/hoodie-cream-worn-front.jpg',
          alt: 'OTRACE Oversized Hoodie in Warm Cream, flat lay front',
          caption: 'Warm Cream, garment dyed after sewing. Onyx Black is the other colorway.',
        },
      },
      {
        h2: 'Does garment dye fade?',
        paragraphs: [
          'Garment dye softens with wear rather than fading out. OTRACE dyes the hoodie and sweatpant after sewing. Wash cold, inside out, and tumble dry low.',
          'That is the care line on the product pages. It is not a promise that the colour never changes. Softening is the point of the finish. High heat is still what shrinks the cotton.',
        ],
        image: {
          src: '/detail-fabric.jpg',
          alt: 'Brushed inside of the garment-dyed 450 GSM cotton fleece',
          caption: 'Brushed cotton after dyeing. Wash cold, inside out.',
        },
      },
    ],
  },
  {
    slug: 'how-an-oversized-hoodie-should-fit',
    h1: 'Oversized hoodie fit',
    description:
      'An oversized hoodie should sit roomy, with a dropped shoulder. The OTRACE hoodie is cut a full size large. Take your usual size, or size down for a cleaner line.',
    date: '2026-10-26',
    eyebrow: 'Fit',
    answer:
      'An oversized hoodie should sit roomy through the body, with a dropped shoulder, longer than a standard fit. Take your usual size for that look, or size down for a cleaner line. This hoodie is cut a full size large on purpose.',
    hero: {
      src: '/products/hoodie-onyx-worn-front.jpg',
      alt: 'Model wearing the OTRACE Oversized Hoodie in Onyx Black, showing the dropped shoulder and roomy body',
      caption: 'Onyx Black, worn at the intended oversized fit. Real campaign photograph, not a diagram.',
    },
    diagram: 'fit',
    sections: [
      {
        h2: 'How should an oversized hoodie fit?',
        paragraphs: [
          'An oversized hoodie should sit roomy through the body, with a dropped shoulder, longer than a standard fit. Take your usual size for that look, or size down for a cleaner line. This hoodie is cut a full size large on purpose.',
          'Roomy does not mean the shoulder seam sits on the elbow, and it does not mean the hem is a dress. On this cut the shoulder seam drops off the shoulder point, the body is square rather than nipped at the waist, and the hem is longer than a standard hoodie. The ribbed cuffs and hem still hold the edge.',
          'Take your usual size when you want that ease. Size down when you want a cleaner line and you are between sizes. The same instruction is on the [Oversized Hoodie](/product/oversized-hoodie) and on the [size chart](/sizing). The chart’s own heading is “Oversized hoodie size chart”, which is the measurements page. This note is the fit.',
        ],
      },
      {
        h2: 'What does a boxy hoodie mean?',
        paragraphs: [
          'A boxy hoodie is cut square through the body with a dropped shoulder, not tapered at the waist. The OTRACE Oversized Hoodie is cut that way.',
          'The side seam falls straight. There is no waist shaping to pull the hem in. That is the whole of the term here. It is not a cropped cut, and it is not a zip hoodie. The pocket is a split kangaroo, and the hood is self-lined and double layer.',
        ],
        image: {
          src: '/products/hoodie-onyx-worn-front.jpg',
          alt: 'Flat lay of the OTRACE Oversized Hoodie in Onyx Black, showing the square body',
          caption: 'Laid flat, the body is square. The shoulder seam is dropped.',
        },
      },
      {
        h2: 'A number you can check',
        paragraphs: [
          'Measurements are garment-flat centimetres. Chest is pit to pit. XS chest is 40 cm, which is 15.7 inches. The full table, including body length and shoulder, is on the [size chart](/sizing), with inches converted from those centimetres.',
          'Size L chest and size L body length are not published. On the factory sheet those cells were smaller than the size below them, so they are left blank rather than printed wrong. Do not invent a number for them.',
          'The hoodie is unisex, XS to 3XL. It is in stock, in Onyx Black and Warm Cream. We ship worldwide, with free delivery in the United States and dispatch in 3–5 business days. Price and stock stay on the [product page](/product/oversized-hoodie). The [hoodies shop](/shop/hoodies) lists the piece next to the sweatpant.',
        ],
        image: {
          src: '/lookbook/look-02.jpg',
          alt: 'Lookbook still of the OTRACE oversized hoodie worn with the wide-leg sweatpant',
          caption: 'Lookbook still. The sweatpant is the same 450 GSM fleece.',
        },
      },
    ],
  },
];

export const journalBlurb =
  'Three notes on the AW2026 fleece: what 450 GSM means, how garment dyeing differs from piece dyeing, and how the oversized hoodie is meant to fit.';

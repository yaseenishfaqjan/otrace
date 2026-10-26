# SEO-LOG

Records for the 26 October 2026 SEO / AEO / GEO brief. The owner asked for this log inside `seo/` rather than the repo root. Entries are appended. The implementation commit is `395723ff66763bcfc887b7d63d12e08547e551d8`. This file is the following commit.

**Verified live: no.** https://otrace.co was still the previous deploy at 2026-10-26T02:40:07Z. There is no deploy pipeline in this environment. Local numbers are from `site/dist/public` after `npm run build`, checked by `node seo/verify.mjs --root site/dist/public` (0 problems, after the self-test failed a dirty fixture on purpose). Saved output: `seo/checks/live-section11-2026-10-26T0240Z.txt` and `seo/checks/local-dist-2026-10-26.txt`.

## [2026-10-26] 3.1 Switch PreOrder to InStock

**Why:** The live product pages were advertising schema.org/PreOrder, so Google and assistants would tell shoppers the drop was not buyable.

**Files changed:** `api/catalog.js`, `site/src/lib/products.ts`, `site/src/lib/structured-data.ts`, `site/src/pages/home.tsx`, `site/src/pages/shop.tsx`, `site/src/pages/product.tsx`, `site/src/pages/legal.tsx`, `site/src/pages/contact.tsx`, `site/src/pages/order-success.tsx`, `site/src/pages/about.tsx`, `site/src/lib/use-page-meta.ts`, `site/index.html`.

**Stock check:** `GET /api/products` has no per-variant quantity. Both products were `preorder: true` with `shipsIn: 6–8 weeks`. The brief says the drop is ready to sell, so `preorder` is now false on both and every colour×size offer is InStock together. No variant was set OutOfStock. The email and cart still have a pre-order branch that renders only when `preorder` / `shipsIn` is set, so a later drop can use it. That branch is not in the prerendered HTML.

**Before (live, 2026-10-26T02:40:07Z):**
`curl -s https://otrace.co/product/oversized-hoodie | grep -c PreOrder` → 1 line, and `grep -o PreOrder` → 14
`grep -c InStock` → 0
`grep -ci pre-order` → 4 lines

**After (local dist):**
`grep -o PreOrder` on the hoodie HTML → 0
`grep -c InStock` → 1 line, `grep -o InStock` → 14
Sweatpant `PreOrder` → 0. Shop `PreOrder` → 0 and `pre-order` → 0. Home `pre-order` → 0. Built HTML files containing `pre-order`: 0.

**Verified live:** no
**Screenshot:** `seo/shots/2026-10-26-hoodie-375.png`, `seo/shots/2026-10-26-hoodie-1440.png`, `seo/shots/2026-10-26-home-375.png`, `seo/shots/2026-10-26-shop-375.png`, `seo/shots/2026-10-26-cart-375.png` (drawer: hoodie, $148, Onyx Black · M, checkout). `seo/shots/2026-10-26-cart-desktop.png` is an earlier frame from before the size click had flushed.
**Commit:** 395723f

## [2026-10-26] 6.1 + 6.2 llms.txt and robots.txt

**Why:** Assistants had no plain-fact summary of the label, and robots.txt did not name the AI crawlers or point at that file.

**Files changed:** `seo/llms.txt` (source), `site/public/llms.txt` (served copy), `site/scripts/seo-public.mjs`, `site/scripts/sync-seo-public.mjs`, `site/scripts/prerender.mjs`, `seo/robots.txt` (mirror).

**Before (live):** `curl -s -o /dev/null -w '%{http_code}' https://otrace.co/llms.txt` → 404. `curl -s https://otrace.co/robots.txt | grep -c GPTBot` → 0.

**After (local dist):** `/llms.txt` is 6663 bytes and matches `seo/llms.txt`. `grep -c GPTBot` on robots → 1. Each named crawler (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended) repeats `Allow: /` and `Disallow: /api/`, because a specific user-agent group does not inherit `User-agent: *`. `LLMs: https://otrace.co/llms.txt` is present.

**Verified live:** no
**Screenshot:** not a visual change
**Commit:** 395723f

## [2026-10-26] 6.4 IndexNow

**Why:** Bing is what ChatGPT searches, and nothing was notifying it when URLs changed.

**Files changed:** `api/indexnow.js`, `api/server.js`, `deploy/after-deploy.sh`, `deploy/.env.example`, `site/public/32dfcb834125ce46de389d323db4c3b0.txt`. Notes: `seo/indexnow.md`. The key is public ownership proof, not a secret.

**Before (live):** `node api/indexnow.js` → `ok: false`, key URL HTTP 404, count 0. Saved in `seo/checks/indexnow-before-key-live.txt`. The CLI retried once after 15s and exited non-zero. That failure is the check working.

**After:** Not submitted. The poster refuses to POST until the live key URL returns the key. After deploy, restart the API or run `sh deploy/after-deploy.sh`. Success is HTTP 200 or 202 from `https://api.indexnow.org/indexnow`.

**Verified live:** no
**Commit:** 395723f

## [2026-10-26] 4.2 Image width and height

**Why:** Live `<img>` tags had no intrinsic dimensions, so the browser could not reserve space.

**Files changed:** `site/src/components/site-image.tsx`, `site/src/lib/image-size.ts`, and the components that render content images (gallery, card, hero, lookbook, about, home, cart).

**Before (live, 2026-10-26):** hoodie 11/11 imgs missing width and height. Shop 4/4. Home 9/10 (the wordmark already had dimensions). Pant 7/7.

**After (local dist):** missing width/height is 0 on home, shop, hoodie, pant, lookbook, about, sizing, garment-dyed. `seo/verify.mjs` fails a fixture img that lacks the attributes, then reports 0 problems on the build.

**Verified live:** no
**Screenshot:** `seo/shots/2026-10-26-hoodie-375.png` (image and buy column present, overflow 0 at 375 and 1440)
**Commit:** 395723f

## [2026-10-26] 4.1 WebP with JPG fallback

**Why:** Product and campaign images were JPEG only, which is most of the weight of a visual shop.

**Files changed:** 29 `.webp` siblings under `site/public/` (products, lookbook, hero, campaign, detail). JPG originals kept. `og.jpg` left as JPEG. The wordmark PNG was already paired and was left as is.

**Before / after (file bytes, quality 85, method 6):** 29 pairs, JPEG 5,181,101 bytes → WebP 2,598,558 bytes. Saved 2,582,543 bytes (49.8%).

**Live page weight before** (HTML bytes, and unique referenced image files), 2026-10-26:

| Page | HTML | imgs missing width/height | unique image bytes |
|---|---:|---:|---:|
| `/` | 20,377 | 9 of 10 | 1,929,335 (13 files) |
| `/shop` | 13,264 | 4 of 4 | 564,434 (5) |
| `/product/oversized-hoodie` | 40,481 | 11 of 11 | 851,174 (7) |
| `/product/wide-leg-sweatpant` | 37,041 | 7 of 7 | 643,815 (5) |
| `/sizing` | 14,097 | 0 | 84,829 (1, the OG image) |

**Local dist after** (HTML, imgs missing dimensions, JPEG fallback bytes, WebP source bytes):

| Page | HTML | missing | JPEG bytes | WebP bytes |
|---|---:|---:|---:|---:|
| `/` | 21,167 | 0 of 10 | 1,286,102 (10) | 993,492 (11) |
| `/shop` | 13,380 | 0 of 4 | 479,605 (4) | 230,644 (4) |
| hoodie | 42,147 | 0 of 11 | 851,174 (7) | 396,790 (7) |
| sweatpant | 37,048 | 0 of 7 | 643,815 (5) | 305,800 (5) |
| lookbook | 29,113 | 0 of 14 | 3,412,838 (15) | 1,609,450 (15) |
| about | 10,589 | 0 of 2 | 279,708 (2) | 191,112 (2) |

A browser that understands `<picture>` fetches the WebP. The JPEG remains the fallback.

**Verified live:** no
**Screenshot:** `seo/shots/2026-10-26-hoodie-1440.png`, `seo/shots/2026-10-26-shop-1440.png`
**Commit:** 395723f

## [2026-10-26] 4.3 Sitemap lastmod

**Why:** Every live URL was stamped 2026-09-29, so a crawler could not tell the site had changed.

**Files changed:** `site/scripts/prerender.mjs`. lastmod was already `new Date()`; the build now throws if any lastmod is not today.

**Before (live):** 13 `<loc>`, all `<lastmod>2026-09-29`.
**After (local dist):** 14 `<loc>` (added `/garment-dyed`), every `<lastmod>2026-10-26`.

**Verified live:** no
**Commit:** 395723f

## [2026-10-26] 4.4 Size guide

**Why:** `/sizing` was a short S/M/L page with no structured data, and size queries are high intent.

**Files changed:** `site/src/pages/sizing.tsx`, `site/src/lib/faqs.ts`, `seo/llms.txt`.

**Before:** live `/sizing` HTML 14,097 bytes, 0 content images. The brief measured 213 words and no structured data.
**After:** local sizing HTML 30,757 bytes. `<main>` word count 700. Tables publish the garment-flat centimetres and the inch conversion `(cm / 2.54).toFixed(1)`. Size L chest, size L body length, and size M inseam stay unpublished because those factory cells ran backwards. The sleeve/waist row keeps that label. FAQPage JSON-LD is `faqLd(SIZING_FAQS)`, the same strings as the visible copy.

**Verified live:** no
**Screenshot:** `seo/shots/2026-10-26-sizing-1440.png`, `seo/shots/2026-10-26-sizing-375.png`. Overflow 0 at both widths.
**Commit:** 395723f

## [2026-10-26] 5.2 + 5.3 FAQ copy and FAQPage

**Why:** Answer engines need the question people type, and a short answer that is the same text as the schema.

**Files changed:** `site/src/lib/faqs.ts`, `site/src/components/faq-list.tsx`, `site/src/lib/structured-data.ts` (`faqLd`), product, sizing, shipping, and `/garment-dyed`. Research: `seo/query-research.md`.

Autocomplete was read again on 2026-10-26 (`hl=en`, `gl=gb` and `gl=us`). Two headings were corrected to the own-first phrasing: “What is 450 GSM hoodie?” (the version with “a” was not own-first) and “450 GSM sweatpants” (“what are 450 gsm sweatpants” returned empty). “do heavyweight sweatpants shrink” was empty and was not written.

FAQPage is generated from the same objects the page renders. Google stopped showing FAQ rich results on 7 May 2026; this markup is for understanding and extraction, not a promised snippet. No `aggregateRating` or review markup (built HTML files containing `aggregateRating`: 0).

**Before:** live hoodie page had no these questions. **After:** local hoodie HTML contains “What is 450 GSM hoodie?” and does not contain the retired “What is a 450 GSM hoodie?”. `seo/verify.mjs` requires each FAQ answer string in `seo/llms.txt` and each question visible in the HTML.

**Verified live:** no
**Screenshot:** `seo/shots/2026-10-26-garment-dyed-375.png`, `seo/shots/2026-10-26-garment-dyed-1440.png`
**Commit:** 395723f

## [2026-10-26] 4.5 Category content

**Why:** The shop has two products, so extra URLs only earn a place when a verified query is not already the title or H1 of an existing page.

**Files changed:** `site/src/pages/garment-dyed.tsx`, `site/src/App.tsx`, footer link.

**Decision:** One new indexable URL, `/garment-dyed`, H1 “What does garment dyed mean?” (own-first on gb and us). Commercial queries that already match a product or collection (heavyweight hoodie, oversized hoodie, wide leg sweatpants, 450 gsm hoodie, garment dyed hoodie, heavyweight sweatpants) did not get a second URL. Sitemap loc count 13 → 14.

**Verified live:** no. `https://otrace.co/garment-dyed` is not on the current deploy.
**Screenshot:** `seo/shots/2026-10-26-garment-dyed-1440.png`
**Commit:** 395723f

## [2026-10-26] 4.6 Currency — blocked

**Why:** A UK or EU shopper converting USD in their head is friction, but the rate and whether it is honoured are a pricing decision.

**Not implemented.** No exchange rate was invented. Prices stay 148 USD and 128 USD in the catalogue, the pages, and `llms.txt`.

**Needs from the owner:** which currencies to show, the rate source, and whether checkout charges that currency or still charges USD.

**Verified live:** n/a
**Commit:** 395723f

## [2026-10-26] 6.3 Entity alignment

**Why:** The fabric field said “400–450 GSM” while the descriptions already said 450 GSM, so assistants could repeat two weights.

**Files changed:** `site/src/lib/products.ts`, `api/catalog.js`, `seo/llms.txt`, `seo/entities.md`.

**Before:** fabric string “400–450 GSM”. **After:** “450 GSM” in the fabric field, descriptions, FAQs, and llms.txt. Colours stay Onyx Black and Warm Cream. Product names stay Oversized Hoodie and Wide-Leg Sweatpant.

**Verified live:** no
**Commit:** 395723f

## [2026-10-26] 6.5 Reviews — not done

**Why:** There are no real reviews to mark up, and invented ratings are a manual-action risk.

**Not done.** No `aggregateRating`, no review schema, no star graphics. Local dist HTML files containing `aggregateRating`: 0.

**Needs from the owner:** a Trustpilot or Google Business Profile source, if reviews are wanted later.

**Commit:** 395723f

## [2026-10-26] Skipped — assets/type-options.html

**Why it was left:** It is a design sheet in `assets/`, not a route the site serves. It still says “Pre-order the drop”. Changing it does not change https://otrace.co.

## [2026-10-26] Section 10 — still needs the owner

- Deploy this branch and restart the API, or run `sh deploy/after-deploy.sh`, then re-run the section 11 commands. Until that happens the live site still fails them.
- IndexNow submission, after `https://otrace.co/32dfcb834125ce46de389d323db4c3b0.txt` returns the key.
- Currency and pricing policy (task 4.6).
- Real reviews, if they are wanted.
- Google Search Console and Bing Webmaster Tools access.
- Google Merchant Center, if shopping surfaces are wanted. The local merchant feed is 28 items, `in_stock` 28, `preorder` 0. The live feed is still the old one until deploy.
- Any stock figure the API does not have. Do not invent quantities.
- Factory confirmation of the three withheld size cells (L chest, L body length, M inseam). They stay unpublished.

## [2026-10-26] Section 11 — measured, not passed on the live site

Live, 2026-10-26T02:40:07Z:

```
hoodie PreOrder lines 1
hoodie PreOrder occ 14
hoodie InStock lines 0
llms 404
GPTBot 0
sitemap locs 13
sitemap lastmod 2026-09-29 (13)
hoodie imgs 11, missing width/height 11
```

JSON-LD on the live pages still parses; it still says PreOrder. That is the old deploy, not a broken document.

Local dist, same day, after the build:

```
hoodie PreOrder occ 0
hoodie InStock lines 1
hoodie InStock occ 14
pant PreOrder 0
shop PreOrder 0
shop pre-order 0
home pre-order 0
llms 6663 bytes
GPTBot 1
sitemap locs 14
sitemap lastmod 2026-10-26
internal hrefs with no built file: 0
verify.mjs: 0 problems
merchant in_stock 28, preorder 0
```

Browser check of the local server at 375 and 1440: overflow 0 on home, shop, hoodie, sweatpant, sizing, and garment-dyed. Hoodie and sweatpant body text does not contain “pre-order”. The hoodie buy line reads in stock, ships in 3–5 business days, $148.

## [2026-10-26] GEO upgrade — llms.txt v2 and AI discovery files

**Why:** `seo/llms.txt` was one 6,663-byte dump of products, prices, measurements, and FAQs. It did not follow the llmstxt.org v2 index shape, so an agent had to load every fact before it could choose a page, and prices in that file would go stale.

**Files changed:** `seo/llms.txt`, `seo/llms-full.txt`, `seo/faq-ai.txt`, `seo/ai.txt`, `seo/identity.json`, `seo/pages/*.md`, `seo/build-discovery.mjs`, `seo/research/llmstxt-v2.md`, `site/scripts/seo-public.mjs`, `site/scripts/prerender.mjs`, `site/src/lib/entity.ts`, `site/src/lib/structured-data.ts`, `site/src/lib/use-page-meta.ts`, `site/src/lib/brand.ts`, `site/src/lib/products.ts` (`450gsm` → `450 GSM`), `deploy/nginx.conf`, `seo/verify.mjs`.

**Before:** `seo/llms.txt` 6,663 bytes, 115 lines, no blockquote, no `[name](url): note` lists. Live `https://otrace.co/llms.txt` HTTP 404. No `llms-full.txt`, `identity.json`, `ai.txt`, `faq-ai.txt`, or `.md` mirrors (live 404 on `llms-full.txt` and `identity.json` as well, measured with this change).

**After (local dist, `node seo/verify.mjs --root site/dist/public` → 0 problems):**

| File | Bytes |
|---|---:|
| `/llms.txt` | 2,964 (55 lines) |
| `/llms-full.txt` | 7,218 |
| `/faq-ai.txt` | 3,019 |
| `/ai.txt` | 1,021 |
| `/identity.json` | 374 |
| `/index.md` | 684 |
| `/about.md` | 492 |
| `/sizing.md` | 2,409 |
| `/garment-dyed.md` | 914 |
| `/shipping.md` | 658 |
| `/product/oversized-hoodie.md` | 1,614 |
| `/product/wide-leg-sweatpant.md` | 1,142 |

The index has the blockquote, `## What We Do Not Do`, `## Contact` (`info@otrace.co`), and `## AI Discovery Files`, and it links every mirror. FAQ answers are generated from `faqs.ts` into `faq-ai.txt` and `llms-full.txt`. Homepage JSON-LD has Organization (description, email, `sameAs: []`) and WebSite. Robots meta on the hoodie is `index, follow, max-image-preview:large` (no NOARCHIVE, no NOCACHE). robots.txt names Bingbot and adds `Discovery: https://otrace.co/identity.json`. IndexNow key file and `deploy/after-deploy.sh` are unchanged.

**Verified live:** no. `https://otrace.co/llms.txt`, `/llms-full.txt`, and `/identity.json` still return 404 until this branch is deployed.

**Screenshot:** `seo/shots/2026-10-26-contact-375.png` — contact page shows info@otrace.co, the form is present, overflow 0 at 375px.

**Commit:** 7013f2d

**Still blocked:** no real social, Wikipedia, or Wikidata URL is on file, so `sameAs` stays empty. Currency is still not implemented. IndexNow still cannot submit until the key file is on the live host.

## [2026-10-26] Journal — /blog and three posts

**Why:** The shop had no URL for the informational queries people type around GSM, dye order, and oversized fit, and https://otrace.co/blog returned 404.

**Files changed:** `site/src/content/posts.mjs`, `site/src/pages/blog.tsx`, `site/src/components/blog-diagrams.tsx`, `site/src/App.tsx`, footer and mobile-menu Journal links, `site/scripts/prerender.mjs` seed, `seo/build-discovery.mjs`, `seo/pages/blog/`, `seo/llms.txt` Optional links, `seo/research/blog-queries.md`. Markdown is also copied to `/llms/pages/`.

**Before (live):** `curl -o /dev/null -w '%{http_code}' https://otrace.co/blog` → 404. Sitemap on the previous deploy had 13 URLs and no `/blog`. Local sitemap before this entry had 14 URLs.

**After (local dist):** prerender lists `/blog` and the three posts as indexable. Sitemap `<loc>` count 18. `node seo/verify.mjs --root site/dist/public` → 0 problems. Article word counts (visible `<article>` text): 450 GSM post 454, dye comparison 473, fit note 464. Each post has 3 images, all with width and height, plus one inline SVG diagram. BlogPosting and Article are on each post. H1s: “450 GSM hoodie meaning”, “Garment dyed vs piece dyed”, “Oversized hoodie fit”.

Images: `detail-fabric.jpg`, `detail-stitch.jpg`, `products/hoodie-onyx-front.jpg`, `products/hoodie-cream-front.jpg`, `products/hoodie-onyx-worn-front.jpg`, `lookbook/look-02.jpg`. WebP siblings already exist. Diagrams are SVG, not photographs of people.

**Verified live:** no. https://otrace.co/blog is still 404 until deploy. IndexNow will pick the new sitemap URLs up only after the key file is hosted and `sh deploy/after-deploy.sh` runs.

**Screenshot:** `seo/shots/2026-10-26-blog-375.png`, `seo/shots/2026-10-26-blog-1440.png`, `seo/shots/2026-10-26-blog-gsm-375.png`, `seo/shots/2026-10-26-blog-gsm-1440.png`, `seo/shots/2026-10-26-blog-dye-375.png`, `seo/shots/2026-10-26-blog-fit-375.png`, `seo/shots/2026-10-26-blog-fit-1440.png`. Overflow 0 at 375 and 1440.

**Commit:** a01bdc4

## [2026-10-26] /llms/pages mirrors

**Why:** The v2 page mirrors already lived beside each HTML route. The plan also asked for a single folder an agent can open.

**Before:** no `/llms/pages/` files. **After:** the same markdown is copied to `/llms/pages/` during the build, including the journal notes. `https://otrace.co/llms/pages/index.md` is linked from `llms.txt`. Local file returns 200 on the preview server. Live is still 404 until deploy.

**Commit:** a01bdc4

## [2026-10-26] Lead capture — Klaviyo, popup, waitlist

**Why:** `/api/subscribe` stored an email and stopped. A second signup with a size was dropped. There was no consent line, no phone, and no wholesale type on contact.

**Before:** `POST /api/subscribe` inserted `email` and `source` only. An existing email returned `alreadySubscribed` and wrote nothing else. Contact stored name, email, subject, and message. No popup. No WhatsApp control, because no number is configured.

**After:** The same route (and `POST /api/waitlist`) stores path, product slug, size, colour, phone, form id, marketing consent time and method, and separate SMS and WhatsApp flags. Flags stay off unless the request sends them. Repeat emails update size and colour. MySQL remains the store. If `KLAVIYO_PRIVATE_API_KEY` or `KLAVIYO_LIST_ID` is missing, the API logs `ESP sync skipped` and still keeps the row. With both set, it imports a Klaviyo profile and subscribes that profile to the list. The app does not send the three-email sequence. Paste that copy from `seo/LEAD-CAPTURE.md` into a Klaviyo Flow. The existing SMTP welcome still sends once, and only when SMTP is configured.

The footer, an 8 second popup (off `/cart`, the cart drawer, and `/order/success`), product waitlist, “Email me my size”, and the contact inquiry type (including Wholesale / custom / collab) are in the storefront. Exit intent is on product pages and `/cart`. Dismiss lasts 14 days, with a Fit guide tab. WhatsApp and Instagram render only from env. No number and no profile URL were invented.

**Verified:** `node --test api/leads.test.mjs` → 7 passed, including the skip log and a mocked Klaviyo profile plus list subscribe. No live Klaviyo key was present, so no profile was created. `node seo/verify.mjs --root site/dist/public` → 0 problems. Prerendered cart and order success do not contain the popup. A headless pass submitted the waitlist for size M / Onyx Black.

**Screenshot:** `seo/shots/2026-10-26-footer-consent-375.png`, `seo/shots/2026-10-26-capture-popup-375.png`.

**Commit:** 4704735

**Still blocked on the owner:** `KLAVIYO_PRIVATE_API_KEY`, `KLAVIYO_LIST_ID`, the Flow itself, `VITE_WHATSAPP_NUMBER` or `PUBLIC_WHATSAPP_NUMBER` at storefront build time, `VITE_INSTAGRAM` or `VITE_INSTAGRAM_URL`, and ManyChat (outside this repo).

## [2026-10-26] Product motion — angles, 450 GSM, set switcher, sticky add

**Why:** The product page had a swipe gallery, colour dots, and a mobile buy bar. It did not let someone scrub the existing angles, read the cloth up close, move to the other piece in the same colour, or keep add-to-cart after scrolling on desktop.

**Before:** Hoodie gallery was four photographs (front, back, worn, worn back). Sweatpant gallery was two. Colour switched in place. “Complete the set” was a card grid under the buy column. The desktop add button scrolled away. Mobile already pinned a bar.

**After:** An Angles range and a mouse drag step through those existing photographs. The caption says they are photographs, not a 3D model. No GLB was added. “Feel the 450 GSM” scrubs `/detail-fabric.jpg`, `/detail-stitch.jpg`, and `/detail-drawcord.jpg`, with the same GSM and garment-dye facts already on the site. The set switcher links to the other product and keeps the selected colour. Desktop shows add-to-cart in a bottom bar only after the in-page button has scrolled above the viewport. Nothing new animates when `prefers-reduced-motion: reduce` is set: frame changes are instant, and the sticky bar has no entrance animation.

**Verified:** `node seo/verify.mjs --root site/dist/public` → 0 problems. Headless Chrome at 375px: angle range moves to the worn frame, the cloth range shows the stitch sentence, the set link becomes `?color=warm-cream` after the cream swatch, overflow 0. At 1440px the sticky bar is absent until that scroll, then it shows the product name. Reduced motion still steps the sweatpant from front to worn. Cart had no dialog after 1.5s.

**Screenshot:** `seo/shots/2026-10-26-angle-scrub-375.png`, `seo/shots/2026-10-26-gsm-375.png`, `seo/shots/2026-10-26-sticky-1440.png`.

**Commit:** 4704735

**Live:** not on https://otrace.co until this branch is deployed.

## [2026-10-26] Conversion motion — weight and cut, quality strip, coasting scrub

**Why:** The store already had a photo angle scrub, a 450 GSM cloth section, a set switcher, and a desktop sticky add bar. It did not yet show the weight and the boxy block on the home page, diagram the cloth with a way through to the product, or give the gallery any follow-through after a drag.

**Approach:** CSS perspective and a pointer tilt. No React Three Fiber and no `<model-viewer>`. There is no GLB in the repo, and a renderer would be extra weight for a file that is not there. `site/public/models/` is an empty folder for a later `hoodie.glb`. Instructions are in `seo/CONVERSION-MOTION.md`.

**Before:** The home page opened on the campaign still, then the two products, then three construction photos. The gallery jumped to the frame under the cursor and stopped. Colour changes replaced the frame at once. Size buttons only changed fill. Lookbook pictures scaled as they entered, with no parallax.

**After:** Under the ticker, the Onyx hoodie front and back photographs sit in a perspective stack. A fine pointer tilts it. Touch and reduced motion leave it still. The images are lazy, so the hero remains the LCP image. After the construction photos, the journal diagrams for GSM, garment dye, and the boxy block each link to the hoodie, Warm Cream, or the size guide. The gallery coasts a short distance after a mouse release, and a colour change fades the previous frame. Reduced motion does neither. A selected size shifts up 1px when motion is allowed and prints that size’s flat measurements. Add to cart reads “Added” for about 1.4 seconds, and the cart drawer still opens. The desktop bar appears when the in-page button has left the screen, or after a drag once the gallery has scrolled up. Lookbook frames shift at most 16px on desktop. Phones do not.

**Verified:** `npm run build`, then `node seo/verify.mjs --root site/dist/public` → 0 problems. Headless Chrome at 375px: the home hero is still `hero-mobile.webp` with `fetchpriority="high"`, the two weight photographs are `loading="lazy"` and overlap (back 335×419, front 248×311), page overflow is 0. Size M on the hoodie prints “chest 48 cm, body length 68 cm, shoulder 17 cm” from the size chart. Add to cart changes a button to “Added”. `/cart` had no dialog after 1.5s. With reduced motion, a size button’s transform is `none`. At 1440px the lookbook sets `--look-shift` and the shift layer extends 24px past the frame so the move does not open a gap. The desktop add bar sits at the bottom of the viewport after scrolling (top 819 in a 900px window). Headless Chrome reports `(hover: hover)` as false, so the pointer tilt stays off there; the idle tilt is limited to fine pointers that allow motion.

**Screenshot:** `seo/shots/2026-10-26-weight-cut-375.png`, `seo/shots/2026-10-26-weight-cut-1440.png`, `seo/shots/2026-10-26-quality-strip-375.png`, `seo/shots/2026-10-26-sticky-motion-1440.png`, `seo/shots/2026-10-26-lookbook-shift-1440.png`.

**Owner asset still needed:** `site/public/models/hoodie.glb`, if a real mesh viewer is wanted later. The photo stack is the live experience until that file exists.

## [2026-10-26] Turntable scaffold, weight scale, set price

**Why:** The research brief asked for a photo turntable, an honest GSM comparison, and a set add that shows the combined price. It asked not to add React Three Fiber. It also asked for a pre-order timeline only when the dates already exist.

**Approach:** CSS crossfade on the photographs already in the gallery. No GSAP and no Framer Motion: four frames do not need a timeline library, and the home hero stays a static image. `site/public/turntable/manifest.json` is empty. A listed sequence replaces the photographs only after its first frame loads. `<model-viewer>` stays deferred. `site/public/models/` is still empty.

**Before:** The angle control stepped from photograph to photograph. The fabric section scrubbed three detail shots with no comparison. “Complete the set” linked to the other product. Both pieces are in stock and ship in 3–5 business days.

**After:** Dragging the gallery, the range, or a horizontal swipe crossfades between those photographs. Reduced motion shows one at a time. The fabric section also moves through the three detail photographs as it scrolls through the viewport, and a drag or the range takes over. Home and the product page show a scale: typical tee ~180 GSM, typical hoodie ~300 GSM, OTRACE fleece 450 GSM. The caption says the first two are typical weights, not OTRACE cloth and not a test of another brand. “Buy both pieces” adds the hoodie and the sweatpant at full catalogue price, same colour and size. There is no bundle discount.

**Not added:** A cut → sew → dye → ship timeline with dates. The catalogue is in stock. The 6–8 week string is not the current offer, and no production calendar is in the repo. No fabric video, because there is none. No GLB.

**Verified:** `node --experimental-strip-types --test site/src/lib/turntable.test.ts` → 5 passed. `npm run build`, then `node seo/verify.mjs --root site/dist/public` → 0 problems. Headless Chrome at 375px: the home hero is still `hero-mobile.webp` with high priority, overflow 0, and the scale includes ~180 GSM. Setting the angle range to 0.5 gives the front and back photographs opacity 0.5 each. The first image stays eager and high priority. “Buy both pieces” changes the button to “Add the set — $276”. Adding it with size M puts the hoodie and the sweatpant in the drawer at that total. `/cart` had no dialog and no Fit guide after 1.2s. The product page text has no pre-order line and no 6–8 week date. `/turntable/manifest.json` is `{ "sequences": {} }`.

**Screenshot:** `seo/shots/2026-10-26-weight-scale-375.png`, `seo/shots/2026-10-26-crossfade-375.png`, `seo/shots/2026-10-26-set-add-375.png`.

**Waiting on the owner:** a 24–36 frame shoot per colourway, named in `site/public/turntable/manifest.json`. A real `site/public/models/hoodie.glb` only if AR or model-viewer is wanted later. No dates for a production timeline.

## [2026-10-26 09:05 UTC] PR #1 merged and deployed to production

**Why:** PR #1 (`cursor/seo-aeo-geo-c03b`) carried the SEO/AEO/GEO surfaces,
lead capture and product motion. It was opened before three fixes had landed
on `main` (image URLs built from SITE_URL, Resend email, webhook hardening),
so it was merged only after a trial merge proved those survived.

**Approach:** Trial-merged into a scratch branch first. No conflicts, and all
five earlier fixes verified present afterwards. Merged fast-forward to `main`
(`eecfc93`), GitHub closed PR #1 as merged (`55f889b2`). Static build deployed
by writing INTO `/opt/otrace/web/dist` (bind mount - replacing the directory
detaches it), two orphaned asset hashes removed, backup at
`/root/otrace-dist-backup-*.tgz`. `deploy/nginx.conf` truncate-written over the
single-file bind mount and reloaded, for the `text/markdown` location block.
API rebuilt.

**Two build defects found and fixed, both the same root cause.** The repo
stores LF and git here runs `core.autocrlf=true`, so a Windows checkout is
CRLF. `seo/build-discovery.mjs` split products on a pattern needing a bare LF
and died with "expected 2 products, parsed 1" before vite ran - the build could
not complete on this machine at all. `seo/verify.mjs` then reported FAIL 4
against byte-correct output for the same reason. Both now normalise line
endings at read. Identical commits had been passing on Linux and failing here.

**Verified on LIVE https://otrace.co, not exit codes:**

- `/llms.txt` 200 3569B · `/llms-full.txt` 200 7218B · `/identity.json` 200 384B
  · `/ai.txt` 200 1043B · `/faq-ai.txt` 200 3019B · `/robots.txt` 200 ·
  `/sitemap.xml` 200 8308B · IndexNow key file 200
- `/blog` and all three posts 200
- Markdown mirrors serve as `text/markdown; charset=utf-8` (`/index.md`,
  `/product/oversized-hoodie.md`, `/llms/pages/index.md`)
- PreOrder count 0 on both product pages and `/shop`; 14x `schema.org/InStock`
- Product page live: angle scrub, GSM scale, "Buy both pieces", notify-me and
  email-my-size with consent copy. No console errors.
- Checkout still creates a live Stripe session after the deploy
- `/api/subscribe` with Klaviyo unset: HTTP 200 `{"esp":"skipped"}`, row stored
  in MySQL with consent recorded. Test rows deleted afterwards.
- `node --test api/leads.test.mjs` 7/7; `node seo/verify.mjs --root
  site/dist/public` 0 problems, exit 0
- IndexNow: accepted, `{"ok":true,"status":202,"count":18}` - on the 4th
  attempt. Three failed with `EAI_AGAIN`.

**Known infrastructure fault, not caused by this deploy:** container DNS on
this VPS fails intermittently with `EAI_AGAIN`, hitting Stripe, Resend and
IndexNow alike. The webhook was hardened for it beforehand; IndexNow needs
retrying by hand when it fails.

**Waiting on the owner:** `KLAVIYO_PRIVATE_API_KEY` and `KLAVIYO_LIST_ID` (lead
capture stores to MySQL until then, nothing is lost); the WhatsApp number env;
`VITE_INSTAGRAM` / `VITE_TIKTOK` (footer renders nothing without them);
currency decision; turntable frames and `hoodie.glb` if ever wanted.

## 2026-10-26 — Homepage chrome, honest catalogue, moulded tips

Owner screenshots of live https://otrace.co, plus the earlier storefront
leftovers. Work is on `cursor/storefront-cleanup-53e0` off `theme-kalles`.
Not deployed. Live otrace.co still shows the old page until the steps below.

**Pricing.** Catalogue prices are the hoodie at 14800 cents ($148) and the
sweatpant at 12800 cents ($128). `listPriceCents` equals `priceCents`, so
`compare_at_price` is null and the -20% badge does not render. One of each
is $276, the sum. Checkout charges each SKU its own `priceCents`. The $80 /
$100 list and the $140 set (commit 617bab2) are removed. `SET_TOTAL_CENTS`
is that sum, not a discount. Hero files `hero-02-set.jpg` and
`hero-03-fleece.jpg` stay on disk and are no longer slides.

**Drawcords.** Factory photos: the tips are white moulded plastic. Eyelets
were not re-verified, so copy still says metal eyelets. The about line “No
plastic anywhere you can feel it” is removed. Wording is in `api/catalog.js`,
`site/src/lib/products.ts`, the journal, the about/home/fabric notes, and
the generated `seo/llms-full.txt` and product/blog mirrors.

**Homepage (`theme/templates/index.json`, `theme/sections/header-group.json`).**
Header group order is the main nav only. Announcement (“Welcome to our
store”), the email/phone row, the Location link, and the $140 promo are out
of the render order. Slideshow is slide 1 only (WORN LOOSE / look-01-wide),
`dotUI` false, `loop` false, `autoplay` 0. The manual collection strip is
out of the page order. Featured-collection padding is tightened and the
grids use the real `fashion` and `featured` collections (two columns).
HOODIES heading is enabled, left-aligned on `/lookbook/look-02.jpg`, copy
“HOODIES / Both colourways / 450 GSM”, dark type because the fleece is
cream. The stairwell frame (`look-08.jpg`) and the tunnel frame
(`look-10-tall.jpg`) are out of the homepage lookbook carousel. Lookbook
pins point at `oversized-hoodie` or `wide-leg-sweatpant` instead of Kalles
demo handles. Journal posts replace the six “Your post's title” cards.

**Why the theme was lying.** `content_for "block"` (double quotes) was
parsed as `content_for 'blocks'`, so section blocks dumped into the first
slot and left the white gap. Empty `product_list: []` is truthy in LiquidJS,
so the collection branch never ran. Option values were plain strings, so
every size got `is-unavailable` and “Variant sold out” even though
`available` on the variant was true. Blog handle `fashion` was not a blog,
so the carousel took the onboarding branch. Image settings were path strings
with no aspect ratio, so banners fell back to 2:1 and cropped the hoodie.

**Verified locally, not on the live host.** `node --test api/theme/theme.test.mjs`
15/15. Rendered index and the hoodie product: no fashionshop, 555, Fashion
Street, “Welcome to our store”, “Your post”, “Variant sold out”,
`is-unavailable`, `$140`, or `look-08` / `look-10` on the homepage. Hoodie
page shows $148.00, white moulded plastic tips, and Add to cart. Chrome
headless screenshots of that render: hero under the nav only, one slide, no
dots, THE COLLECTION in the first viewport, HOODIES text on the cream image
(sampled pixels ~rgb(15,15,15) on the cream ground).

**Deploy (no SSH from this run).** From the repo on the VPS, the API image
build context is the repo root (`api/Dockerfile`), so `theme/` and
`api/catalog.js` ship together. Rebuild and restart the `api` service in
`deploy/docker-compose.yml`. Rebuild the site and write the new `dist` into
the existing web bind mount (`deploy/web/dist` when compose is run from
`deploy/`; on the host that mount is `/opt/otrace/web/dist` — write into the
directory, do not replace it). `/`, `/shop`, `/product/`, and `/cart` are
proxied to the theme by the external nginx snippet
`deploy/nginx-theme-routes.conf`. This change does not edit nginx. `/blog`
and `/llms.txt` stay on the static site. Then `sh deploy/after-deploy.sh`
for IndexNow.

## 2026-10-26 — Lower homepage: the set, the journal, the footer

Same branch, still not deployed. Live otrace.co still shows the old page.

**Removed.** The homepage Accessories carousel (Tech / Design, “Your post's title”, the Shopify “hasn't published any blog posts” line, CONTINUE READING) is gone. Nothing empty was left in its place.

**Replaced.**
- THE SET is four catalogue cards: Oversized Hoodie in Onyx Black and Warm Cream ($148 each), Wide-Leg Sweatpant in Onyx Black and Warm Cream ($128 each). Photos are the existing flat fronts (`hoodie-onyx-front`, `hoodie-cream-front`, `pant-onyx-front`, `pant-cream-front`). The subtitle names the two colourways and the catalogue price of each piece.
- FROM THE STUDIO is the three live journal posts — 450 GSM hoodie meaning, Garment dyed vs piece dyed, Oversized hoodie fit — with their real images, dates, and excerpts, linking to `/blog/:slug`. The article card is passed into `{% render %}`, so the image keeps its ratio and the excerpt prints.
- @OTRACE is the lookbook strip (looks 07, 06, 05, 04, 01, 03). The stairwell and tunnel frames stay off this carousel. Section padding above and below is 28–36px.
- Footer Categories is Shop, Hoodies, Bottoms, Lookbook. Useful links is Blog, Garment dyed, Sizing, Contact. Information stays Shipping, Sizing, Contact, Privacy. The trust row is unchanged: free US delivery, ships in 3–5 days, 30 day returns, Stripe.

**Verified locally.** `node --test api/theme/theme.test.mjs` 15/15. Rendered homepage has no “Your post”, ACCESSORIES, “hasn't published”, CONTINUE READING, $140, fashionshop, look-08, or look-10. Chrome screenshots at 1440 and 390 show the four colourway photos, the three journal cards, the lookbook frames, and a filled footer.

## 2026-10-26 — Shop and lookbook

Same branch, still not deployed. Live otrace.co still shows two back-view cards, the −20% badge, and the masonry lookbook until this is deployed.

**Shop (`/shop`).** The listing is four colourway cards, in this order, using the flat files in `site/public/products/`:

| Card | Primary | Hover |
| --- | --- | --- |
| Oversized Hoodie — Onyx Black | `hoodie-onyx-front.jpg` | `hoodie-onyx-back.jpg` |
| Oversized Hoodie — Warm Cream | `hoodie-cream-front.jpg` | `hoodie-cream-back.jpg` |
| Wide-Leg Sweatpant — Onyx Black | `pant-onyx-front.jpg` | `pant-onyx-back.jpg` |
| Wide-Leg Sweatpant — Warm Cream | `pant-cream-front.jpg` | `pant-cream-back.jpg` |

Prices are the catalogue: hoodie $148, sweatpant $128. `listPriceCents` equals `priceCents`, so there is no compare-at price and no −20% badge. Each card links to the real product (`/product/oversized-hoodie`, `/product/wide-leg-sweatpant`). The column switch, sort, and filter are off, and the empty toolbar is hidden. The AW2026 heading padding is 16px / 4px, and the collection list strip above it is out of the template order, so the four fronts sit under the nav. `/shop/hoodies` and `/shop/bottoms` use the same colourway cards, two each.

**Lookbook (`/lookbook`).** The theme page (the one live otrace.co/lookbook already renders) keeps eight frames in a 3:4 crop, two across:

1. `look-10-tall.jpg` — Onyx hoodie with the Warm Cream sweatpant
2. `look-06.jpg` — Warm Cream hoodie with the Onyx sweatpant
3. `look-01-tall.jpg` — Onyx set, corridor
4. `look-02.jpg` — Warm Cream set, seated
5. `look-04-tall.jpg` — both colourways
6. `look-03.jpg` — Onyx set, hood up
7. `look-09.jpg` — Onyx hoodie, logo
8. `look-05.jpg` — Warm Cream hoodie, logo

Dropped `look-08.jpg` (stairwell, mostly architecture) and `look-07-tall.jpg` (a second cream-seated frame). The heading is 2xl with 12px of padding. Header announcement, email row, and the $140 line stay out of the render order, same as the homepage. Footer Categories and Useful links are the same filled menus as the homepage.

`deploy/nginx-theme-routes.conf` now documents `/lookbook` → `/api/theme-preview/page/lookbook`. Live already serves the theme lookbook; the snippet had still listed it as a React page. The file is not loaded automatically. Applying it means truncate-write `/opt/scalaro/nginx.conf`, `nginx -t`, then reload.

**Verified locally.** Theme tests 15/15. Rendered `/shop` has the four fronts, hover backs, `$148.00` and `$128.00`, and no −20%, `$100`, `$80`, or layout switch. Rendered `/lookbook` has the eight frames above and neither look-07 nor look-08. Chrome at 1440 and 390: shop cards start under the nav; lookbook rows share one height (about 792px at 1440).

## 2026-10-26 — Info pages and worldwide shipping

Same branch, still not deployed. Live otrace.co still shows the promo bars, the garment-dyed sentence “each $80.00 (was $100.00)”, and the sizing page’s orphan chart headings until this is deployed.

**Shipping.** Checkout now accepts a worldwide address list (United States, United Kingdom, EU, and the other countries in `SHIP_COUNTRIES`). The only Stripe rate on file is still $0, labeled “Free delivery — United States”. Hosted Checkout applies that one rate to every allowed country, so a non-US order also checks out at $0 until a real international tariff is configured. Copy says we ship worldwide and that free delivery is for United States addresses. It does not say free worldwide. JSON-LD `OfferShippingDetails` stays a $0 offer for `addressCountry: US`. `llms.txt` “What We Do Not Do” no longer says international shipping is unavailable.

**Garment dyed.** Theme page uses the catalogue prices ($148 hoodie, $128 sweatpant), the onyx and cream hoodie fronts, and the three detail photos (`detail-fabric.jpg`, `detail-stitch.jpg`, `detail-drawcord.jpg`). A CSS/SVG diagram shows knit → cut → sew → dye. `prefers-reduced-motion` stops that animation.

**Sizing.** One hoodie table (chest, body length, shoulder, sleeve/waist) and one sweatpant table (outseam, inseam, leg opening). Centimetres stay the source. Inches are centimetres ÷ 2.54, to 0.1. Three blank cells are estimated from the confirmed sizes on either side and marked est.: chest L 49 cm, body length L 69 cm, inseam M 76 cm. Those values are not written back into `shared/size-chart.json`. The orphan headings (Oversized hoodie size chart, Wide leg sweatpants size chart, Unisex hoodies size chart) are gone.

**Contact.** The theme page posts JSON to `/api/contact` with name, email, subject, type (order, sizing, wholesale, other), and message. The email button is info@otrace.co. WhatsApp renders only when `WHATSAPP_NUMBER` (or the public/Vite aliases) is 8–15 digits. Crisp or Tawk loads only when its id env is set. A Help panel links to email, sizing, shipping, and garment dyed. It is not a chat agent.

**Chrome.** Header announcement, phone, and location stay out of the render order. Footer Categories and Useful links are filled. Shopify demo social URLs (`facebook.com/shopify` and the rest) are blank, so the footer does not publish them. Page overflow measured 0 at 375px and 1440px on garment-dyed, sizing, and contact. Theme tests 15/15.

**Still needs the owner before it can be turned on:** a GLB, turntable frames, `KLAVIYO_PRIVATE_API_KEY` and `KLAVIYO_LIST_ID`, a WhatsApp number, and Crisp or Tawk ids. None of those are invented here.

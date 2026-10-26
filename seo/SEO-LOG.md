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

**Commit:** filled in after this entry is committed.

**Still blocked:** no real social, Wikipedia, or Wikidata URL is on file, so `sameAs` stays empty. Currency is still not implemented. IndexNow still cannot submit until the key file is on the live host.

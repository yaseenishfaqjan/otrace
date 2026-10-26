# Query research — 2026-10-26

Source: `https://suggestqueries.google.com/complete/search` with `client=firefox`, `hl=en`, and `gl` of `gb` and `us`. Own-first means the typed string came back as suggestion 1. `gb` and `us` agreed on every decision below.

A query that is already the product title or H1 did not get a new URL. Informational phrasing that is not that title became an FAQ on the page that owns the product, or one new page when no existing title owned it.

## Used as on-page questions

| Typed query | Result | Where it went |
|---|---|---|
| do heavyweight hoodies shrink | own-first. “does a heavyweight hoodie shrink” was not; its first suggestion was this plural | Hoodie FAQ |
| what is 450 gsm hoodie | own-first. “what is a 450 gsm hoodie” was not; its first suggestion dropped “a” | Hoodie FAQ heading is “What is 450 GSM hoodie?” |
| are hoodies unisex | own-first | Hoodie FAQ |
| boxy hoodie meaning | own-first | Hoodie FAQ |
| do sweatpants shrink in the dryer | own-first. First suggestion of “do sweatpants shrink” | Sweatpant FAQ |
| 450 gsm sweatpants | own-first. “what are 450 gsm sweatpants” and “what is 450 gsm sweatpants” returned empty, so those questions were not written | Sweatpant FAQ heading is the phrase people type. No new URL: the product page already sells this |
| what does garment dyed mean | own-first | New page `/garment-dyed`. H1 is the question. Existing product and `/shop/hoodies` copy already describes a garment-dyed hoodie, so that commercial query did not get a second URL |
| garment dyed vs piece dyed | own-first | H2 on `/garment-dyed` |
| does garment dye fade | own-first. “will garment dye fade” was not; its first suggestion was this | H2 on `/garment-dyed`. Answer uses the existing “softens rather than fades” claim |
| oversized hoodie size chart | own-first | `/sizing` title and H1 |
| wide leg sweatpants size chart | own-first. First suggestion of “wide leg sweatpants sizing” | `/sizing` |
| how should an oversized hoodie fit | own-first | `/sizing` |
| unisex hoodies size chart | suggestion under “unisex hoodies”, which was itself own-first | `/sizing` |
| what is your return policy | own-first | Returns heading on the shipping page. Retailer-name suggestions under “return window” were not used as a heading |

## Not given a new URL

These came back own-first and are already the product or collection the shop ranks with: heavyweight hoodie, oversized hoodie, wide leg sweatpants, heavyweight sweatpants, garment dyed hoodie, 450 gsm hoodie, 450 gsm sweatpants.

“do heavyweight sweatpants shrink” returned an empty suggestion list on both `gb` and `us`, so it was not written.

## Collision check for `/garment-dyed`

Existing titles and H1s at the time of the decision: home (“Worn loose”), shop, Oversized Hoodie, Wide-Leg Sweatpant, sizing (then a size-guide title, now “Oversized Hoodie Size Chart”), about, lookbook, contact, shipping, terms, privacy. None of them was the question “What does garment dyed mean?”. The new page title and H1 are that question, not “Garment Dyed Hoodie”.

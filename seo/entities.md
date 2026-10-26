# Entity facts

These are the names and numbers the pages, the FAQ answers, and `llms.txt` are supposed to repeat. Prices are US dollars. There is no converted currency (brief task 4.6 is blocked).

| Fact | Form used |
|---|---|
| Brand | OTRACE |
| Site | https://otrace.co |
| Hoodie name | Oversized Hoodie |
| Hoodie URL | https://otrace.co/product/oversized-hoodie |
| Hoodie price | 148 USD (14800 cents in `api/catalog.js`) |
| Sweatpant name | Wide-Leg Sweatpant |
| Sweatpant URL | https://otrace.co/product/wide-leg-sweatpant |
| Sweatpant price | 128 USD (12800 cents) |
| Fabric | 450 GSM heavyweight cotton fleece, pre-shrunk, garment dyed |
| Colours | Onyx Black, Warm Cream |
| Sizes | XS, S, M, L, XL, 2XL, 3XL, unisex |
| Availability | in stock. The catalogue flag `preorder` is false on both products. The API has no per-variant quantity, so every colour×size offer is `InStock` together. Nothing was marked `OutOfStock` |
| In-stock dispatch | 3–5 business days, free, United States only for AW2026 |
| Returns | unworn, tags attached, 30 days from delivery. Refunds 5–10 business days after the parcel arrives. Faulty items: the store covers return shipping |

The fabric field used to say “400–450 GSM” while the product descriptions already said 450 GSM. The field now says 450 GSM, which is the weight the descriptions and the FAQ answers use.

Size cells that are not published, because the factory sheet ran backwards: hoodie L chest, hoodie L body length, sweatpant M inseam. The “Sleeve / waist” row is published under that label. Inches on the sizing page are centimetres divided by 2.54, rounded to one decimal in the page. They are not a second set of measurements.

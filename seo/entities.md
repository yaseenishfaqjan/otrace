# Entity facts

These are the names and numbers the pages, the FAQ answers, and `llms.txt` are supposed to repeat. Prices are US dollars. There is no converted currency (brief task 4.6 is blocked).

| Fact | Form used |
|---|---|
| Brand | OTRACE |
| Site | https://otrace.co |
| Hoodie name | Oversized Hoodie |
| Hoodie URL | https://otrace.co/product/oversized-hoodie |
| Hoodie price | 80 USD (8000 cents in `api/catalog.js`), list 100 USD (10000 cents) |
| Sweatpant name | Wide-Leg Sweatpant |
| Sweatpant URL | https://otrace.co/product/wide-leg-sweatpant |
| Sweatpant price | 80 USD (8000 cents), list 100 USD (10000 cents) |
| Set | 140 USD for one hoodie and one sweatpant (14000 cents), list 200 USD |
| Fabric | 450 GSM heavyweight cotton fleece, pre-shrunk, garment dyed |
| Colours | Onyx Black, Warm Cream |
| Sizes | XS, S, M, L, XL, 2XL, 3XL, unisex |
| Availability | in stock. The catalogue flag `preorder` is false on both products. The API has no per-variant quantity, so every colour×size offer is `InStock` together. Nothing was marked `OutOfStock` |
| In-stock dispatch | 3–5 business days. Ships worldwide. Free delivery is for United States addresses. No international carrier tariff is published. |
| Returns | unworn, tags attached, 30 days from delivery. Refunds 5–10 business days after the parcel arrives. Faulty items: the store covers return shipping |
| Email | info@otrace.co |
| sameAs | none. No Wikipedia, Wikidata, or social profile URL is published |

The fabric field used to say “400–450 GSM” while the product descriptions already said 450 GSM. The field now says 450 GSM, which is the weight the descriptions and the FAQ answers use.

Size L chest, size L body length, and size M inseam stay null in the source data, because the factory sheet ran those cells backwards. The sizing page estimates each of those three from the confirmed sizes on either side and marks the cell “est.” Those estimates are not factory measurements. The “Sleeve / waist” row is published under that label. Inches on the sizing page are centimetres divided by 2.54, rounded to one decimal. They are not a second set of measurements.

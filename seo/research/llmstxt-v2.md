# llms.txt v2 — what was applied

Read 2026-10-26 from https://llmstxt.org/ (Jeremy Howard, updated 10 August 2026).

The spec wants a small index, not a dump of the site:

1. H1 with the site name.
2. A blockquote with the one sentence an agent needs.
3. Body paragraphs before any H2, for how to read the file.
4. H2 sections whose lists are `[name](url): note`, pointing at markdown versions of pages.
5. An `## Optional` section for links an agent can skip.

Page mirrors live at the same path with `.md` added (`/sizing.md`). A path with no filename uses `index.md`. HTML should carry `rel="alternate" type="text/markdown"`, and `rel="describedby"` pointing at `/llms.txt`. An HTTP `Link` header is the other accepted form. OTRACE does both: the prerender writes the link tags, and nginx adds `Link: </llms.txt>; rel="describedby"` on `.md` responses. One nginx `location /` serves every HTML route, so a per-page `Link` header there would mean repeating every security header. The HTML tags cover the pages.

Google Search has said it does not use llms.txt for ranking. The index says that in its own body so an agent does not claim otherwise. The file is still published for other agents and for the ChatGPT / Bing path. Bingbot is named in robots.txt. `LLMs:` and `Discovery:` are hints next to the sitemap line. They are not a standards-track robots directive.

## What was not copied from other brands

- No prices in the index. The catalogue price is in `llms-full.txt` and the product markdown, with a line that the live HTML wins.
- `sameAs` is an empty array. The repo has env slots for Instagram, TikTok, and Pinterest, and no URL that is known to exist. Inventing those profiles, or a Wikipedia / Wikidata id, would be a false entity.
- No reviews.
- No currency conversion.

## Sources of truth

| File | Written by |
|---|---|
| `seo/llms.txt` | Hand, checked against `ENTITY_SUMMARY` |
| `seo/identity.json` | Hand, same sentence and `info@otrace.co` |
| `seo/ai.txt` | Hand |
| `seo/llms-full.txt`, `seo/faq-ai.txt`, `seo/pages/*.md` | `seo/build-discovery.mjs`, from `faqs.ts`, `products.ts`, and `entity.ts` |

`node seo/verify.mjs` fails if a FAQ answer is missing from `faq-ai.txt` or `llms-full.txt`, or if a size-chart centimetre is missing from `llms-full.txt`.

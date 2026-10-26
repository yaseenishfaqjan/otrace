# OTRACE — SEO / AEO / GEO brief for the build agent

**Site:** https://otrace.co · **Repo:** `C:\Users\PCL\Documents\otrace`
**Written:** 26 October 2026 · **Status at writing:** live, but still
advertising itself as pre-order

Paste this whole file to the agent. It is written to be handed over, not
summarised.

---

## 0. Read this part first

You are working on a live store that takes money. Three rules override
everything else in this document:

1. **Never report a task done from a command's exit code.** Check the live
   site. A deploy can exit 0 having done nothing.
2. **A check that cannot fail is not a check.** Before trusting any test,
   make it fail on purpose once. If you cannot, the test is decoration.
3. **Look at the page.** Structural checks pass on broken copy. Take a
   screenshot before you call something finished.

Everything in section 8 is non-negotiable record-keeping. If you do the work
and do not log it, the work does not count, because nobody can verify it.

---

## 1. What SEO, AEO and GEO actually mean here

They are three different audiences reading the same pages.

**SEO — Search Engine Optimisation.** A person types into Google and picks a
blue link. You win by matching a query, being crawlable, loading fast, and
being more useful than the result above you.

**AEO — Answer Engine Optimisation.** The engine answers without a click —
Google's AI Overviews, featured snippets, People Also Ask. You win by giving
a short, direct, extractable answer to a specific question, usually in the
first two sentences under a heading that *is* the question. Structured data
helps the machine know which text answers what.

**GEO — Generative Engine Optimisation.** ChatGPT, Perplexity, Claude and
Copilot recommend a brand inside a conversation. There is no ranking and no
click-through — you are either in the answer or invisible. You win by being
factually legible: unambiguous product facts, consistent naming, plain
numbers, no marketing fog, and a machine-readable summary of who you are.

**Why GEO matters more than it looks.** On the sister project (fabrioza.com)
we measured where attributed leads actually came from: of 16 leads carrying a
source, **15 were `chatgpt.com` and 1 was `copilot.com`**. Zero were paid ads.
AI assistants were, measurably, the biggest identifiable channel, and almost
nobody optimises for them. Treat GEO as a first-class target, not a bonus.

A practical consequence: **Bing is what ChatGPT searches.** Getting Bing to
recrawl matters as much as Google.

---

## 2. What is already good — do not "fix" these

Audited live on 26 Oct 2026. Leave these alone unless a task below says
otherwise.

| | state |
|---|---|
| Server rendering | **Good.** The raw HTML carries 343 visible words, a real `<h1>` and no empty root div. Crawlers and AI bots get content without running JS. This is the single most important thing a React/Vite shop can get right, and it is right. |
| Product structured data | **Very good.** `ProductGroup` with a `Product` + `Offer` per variant, plus `sku`, `brand`, `itemCondition`, `shippingDetails` and `hasMerchantReturnPolicy`. Better than most stores. |
| Collection pages | `/shop` carries `CollectionPage` + `ItemList` + `BreadcrumbList`. |
| Titles, descriptions, canonical, OG | Present and sensible on the pages checked. |
| Sitemap | Exists, includes image entries per URL. |
| robots.txt | Allows everything except `/api/`. AI crawlers are permitted through `User-agent: *`. |
| Encoding | Correct UTF-8. (If you see `â€”` in a terminal, that is your pipeline not decoding, not the site. Verify before "fixing" it.) |

---

## 3. The blocker — fix this before anything else

**The whole site still says pre-order.** Measured on
`/product/oversized-hoodie`:

- `schema.org/PreOrder` appears **14 times** in the structured data
- the words "pre-order" / "Pre-order" appear **11 times** in the copy
- the homepage hero reads "Autumn / Winter 2026 — pre-order open"

You are told the product is ready to sell. Until this changes:

- Google and AI assistants will tell shoppers the product is not available yet
- any Merchant Center / shopping surface will treat it as pre-order
- the structured data contradicts the buy button, which is a trust problem
  and a Merchant Center disapproval risk

**Task 3.1 — switch to live selling.**
Change every `availability` from `https://schema.org/PreOrder` to
`https://schema.org/InStock`, and rewrite the pre-order copy as in-stock
copy. Find the source of truth in the repo (`site/src` and whatever feeds the
catalogue) and change it there — do not patch built output.

Also: if any variant is genuinely out of stock, it must be `OutOfStock`, not
`InStock`. Do not blanket-set everything to in stock if the stock data says
otherwise. Check what the API actually reports before deciding.

**Verify:** `curl -s https://otrace.co/product/oversized-hoodie | grep -c PreOrder`
must return 0, and the same for the sweatpant page and `/shop`.

---

## 4. SEO tasks

**4.1 — Image format and weight.** Every product image is JPG; there is no
WebP or AVIF anywhere (77 jpg references on one product page, 2 png). This is
a visual, mobile-first fashion store, so images are the page weight. Convert
to WebP with a JPG fallback, keep the originals, and target the same visual
quality. Report before/after total bytes per page.

**4.2 — Image dimensions.** **Zero `<img>` tags carry `width` and `height`
attributes.** Without them the browser cannot reserve space, so the page
jumps as images load. That is Cumulative Layout Shift, a Core Web Vitals
metric and a real ranking factor. Add intrinsic `width` and `height` to every
`<img>`. Keep the CSS sizing as it is; the attributes set the aspect ratio
only.

**4.3 — Sitemap freshness.** `lastmod` is `2026-09-29` on every URL. Update
it on deploy, ideally automatically. A stale `lastmod` tells crawlers nothing
has changed.

**4.4 — Size guide schema and content.** `/sizing` has **no structured data
at all** and 213 words. Apparel size queries are high-intent — someone
checking sizing is close to buying — and "size guide" style content is a
genuine search magnet. Add measurements as a real table, and consider
`FAQPage` for the questions it answers. Give the actual garment measurements,
not just S/M/L.

**4.5 — Thin surface area, and what to do about it.** You have 13 URLs and 2
products. More product pages are not available to you, so the SEO surface has
to come from content that catches category demand. Before writing anything,
**research the queries** (section 7) and only write pages that a verified
query exists for. Do not invent topics.

**4.6 — Currency.** Everything is USD. If you sell to the UK or EU, a shopper
mentally converting is friction at the moment of decision. This is a business
decision, not a technical one — **ask the owner before implementing**, and do
not invent an exchange rate.

---

## 5. AEO tasks

**5.1 — Answer the question in the first two sentences.** For every FAQ or
guide section, the heading should be the question as people ask it, and the
answer should be complete within roughly 40 words before any elaboration.
Answer engines lift the first direct statement.

**5.2 — FAQ content that matches real questions.** Streetwear buyers ask
specific things: does a 450 GSM hoodie shrink, what does garment dyed mean,
how does oversized sizing compare to normal, will the colour fade, is it
unisex, what is the return window. Verify each against autocomplete
(section 7) before writing it.

**5.3 — FAQPage structured data, generated from the visible copy.** Never
hand-write the schema separately from the page text. Generate the JSON-LD
*from* the rendered answer so the two cannot drift — Google requires them to
match, and hand-copied pairs always diverge eventually.

**Note on expectations:** Google **stopped showing FAQ rich results entirely
on 7 May 2026**. FAQPage markup is still valid and Google says it still uses
it to understand a page, but it will not produce a visible snippet. Do the
work for comprehension and for AI extraction, not for stars in the SERP, and
do not promise the owner rich results.

---

## 6. GEO tasks — the highest-leverage section

**6.1 — Create `/llms.txt`.** It currently **404s**. This is the file AI
assistants read to understand a brand. It must contain, in plain text:

- what OTRACE is, in one sentence an assistant can quote verbatim
- the products, with real specifications: 450 GSM, heavyweight fleece,
  garment dyed, oversized/boxy, wide-leg, the two colourways by name
- prices and currency
- sizing in actual measurements
- shipping destinations, times and costs
- the returns window and conditions
- a short FAQ written for extraction
- a list of key page URLs

Write it as facts, not marketing. "Heavyweight 450 GSM cotton fleece, garment
dyed after construction, cut oversized" is quotable. "Elevated essentials for
the modern wardrobe" is not, and an assistant will skip it.

**6.2 — Point robots.txt at it** and add explicit AI crawler allowances. They
are already permitted via `User-agent: *`, so this is about being unambiguous:

```
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

LLMs: https://otrace.co/llms.txt
```

**6.3 — Consistent entity naming.** Decide one canonical form of every fact
and use it everywhere: brand name casing, product names, the GSM figure, the
colourway names, the fabric description. An assistant that sees "Onyx Black"
on one page and "onyx" on another has two facts to reconcile and will often
drop both.

**6.4 — Submit to IndexNow on every deploy.** One POST tells **Bing and
Yandex** to recrawl immediately, and Bing is what ChatGPT searches. Generate
a key, serve it at `/<key>.txt`, and wire the submission into the deploy
script so it cannot be forgotten. On the sister project this step was
specified in writing and still missed on every deploy for a day, because it
depended on someone remembering.

**6.5 — Do not fabricate reviews.** The site has no reviews. Do **not** add
`aggregateRating` or `review` to the structured data, and do not put a star
rating in the design. Fabricated review markup risks a manual action, and a
rating with nothing behind it is the same problem whether it is in schema or
in a graphic. When real reviews exist, add it then.

---

## 7. How to research a query before writing anything

Never write a page for a phrase you have not verified. Google Autocomplete
only suggests strings drawn from real queries, so it proves demand exists
(though not how much):

```bash
curl -s -G "https://suggestqueries.google.com/complete/search" \
  --data-urlencode "client=firefox" \
  --data-urlencode "hl=en" \
  --data-urlencode "gl=gb" \
  --data-urlencode "q=heavyweight hoodie 450 gsm"
```

Rules:

- If the query comes back as its own first suggestion, people search it.
- If only variants come back, **target the variant** — that is the phrasing
  people actually type.
- If nothing comes back, do not write the page.
- Change `gl` to the market you care about; `gb` and `us` give different
  answers.

**Check for collisions before creating a page.** Two pages targeting one
query means the engine picks between them, usually not the one you wanted.
Before publishing, list every existing title and H1 and confirm the new
phrase is not already owned. On the sister project this check found four
pages fighting each other.

---

## 8. Record-keeping — mandatory

Keep **`SEO-LOG.md`** in the repo root. Append one entry per task, never
rewrite history. Commit it with the change it describes.

```markdown
## [2026-10-26 14:20] 3.1 Switch PreOrder to InStock

**Why:** 14 occurrences of schema.org/PreOrder and 11 "pre-order" strings
were telling Google and AI assistants the product was not buyable.

**Files changed:** site/src/data/catalogue.ts, site/src/pages/Home.tsx

**Before:** curl .../product/oversized-hoodie | grep -c PreOrder  ->  14
**After:**  curl .../product/oversized-hoodie | grep -c PreOrder  ->  0
**After:**  curl .../product/oversized-hoodie | grep -c InStock   ->  14

**Verified live:** yes — fetched the deployed URL, not the local build
**Screenshot:** docs/shots/2026-10-26-instock.png
**Rich Results Test:** passed, 2 Product items, 0 errors
**Commit:** a1b2c3d
```

Every entry must carry:

1. **Task number** from this brief
2. **Why**, in one sentence — the problem, not the action
3. **Files changed**
4. **A before number and an after number** from the same command. Not
   "updated" — the actual measurements.
5. **Verified live** — the command was run against `https://otrace.co`, not
   against a local build or a dev server
6. **Screenshot** for anything visual
7. **Commit hash**

**Also log what you did NOT do and why.** A task skipped for a good reason
(waiting on the owner, would break something, evidence did not support it) is
information. A task silently dropped is a hole nobody can see.

**If a check fails, log the failure and leave it failing.** Do not adjust the
check until it passes. On the sister project a verification script reported
"0 of 64 pages updated" after all 56 had written correctly — the bug was in
the check, not the work, and the only way to find that was to investigate
rather than soften the assertion.

---

## 9. Order of work

Do them in this order. Each one is cheap to verify before moving on.

| # | Task | Why this position |
|---|---|---|
| 1 | 3.1 PreOrder → InStock | Everything else is wasted while the site says it cannot sell |
| 2 | 6.1 + 6.2 llms.txt and robots | Cheapest, highest-leverage, and GEO is the measured channel |
| 3 | 6.4 IndexNow on deploy | Makes every later change reach Bing the same day |
| 4 | 4.2 Image width/height | One pass, direct Core Web Vitals win |
| 5 | 4.1 WebP conversion | Biggest weight reduction on a visual store |
| 6 | 4.3 Sitemap lastmod | Trivial, and the site has just changed substantially |
| 7 | 4.4 Size guide | High-intent page, currently thin and schema-less |
| 8 | 5.2 + 5.3 FAQ content and schema | Only after section 7 research |
| 9 | 4.5 Category content | Only for verified queries |
| 10 | 4.6 Currency | **Ask the owner first** |

---

## 10. Things that need the owner, not you

Do not attempt these; list them in the log as blocked and say what you need.

- **Reviews.** Trustpilot or Google Business Profile. Nothing you write can
  substitute, and fabricating it is a manual-action risk.
- **Currency and pricing policy.** Needs a decision on rate and whether it is
  honoured.
- **Google Search Console and Bing Webmaster Tools.** Account access.
- **Google Merchant Center**, if shopping surfaces are wanted. Note that a
  feed disagreeing with on-page structured data causes disapprovals, so fix
  task 3.1 first.
- **Any stock figure you cannot read from the API.** Guessing availability is
  worse than leaving it.

---

## 11. Final verification before you call it done

Run all of these against the **live** site and paste the output into the log:

```bash
# 1. the store says it can sell
curl -s https://otrace.co/product/oversized-hoodie | grep -c PreOrder     # want 0
curl -s https://otrace.co/product/oversized-hoodie | grep -c InStock      # want >0

# 2. AI surface exists
curl -s -o /dev/null -w '%{http_code}\n' https://otrace.co/llms.txt       # want 200
curl -s https://otrace.co/robots.txt | grep -c GPTBot                     # want >0

# 3. every structured-data block still parses
for u in / /shop /product/oversized-hoodie /product/wide-leg-sweatpant; do
  curl -s "https://otrace.co$u" \
  | python -c "import sys,re,json;[json.loads(b) for b in re.findall(r'application/ld\+json[^>]*>(.*?)</script>',sys.stdin.read(),re.S)];print('$u ok')"
done

# 4. no page links to a 404
#    crawl every internal href and report any non-200

# 5. images
#    report total page bytes before and after, and count <img> without width/height (want 0)
```

Then open the site in a browser at **375px** and at desktop width, and
confirm: no horizontal scroll, the buy button works, the price and
availability on the page agree with the structured data, and nothing still
says pre-order.

Paste the final numbers into `SEO-LOG.md` with the date.

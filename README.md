# OTRACE — AW2026

A separate project from `southern-heritage-co`. Nothing is shared between them:
own folder, own dependencies, own database, own Stripe account.

```
otrace/
  assets/      source imagery + the scripts that generated and processed it
  site/        React + Vite source the SEO copy was ported from
  api/         Express + Stripe + MySQL, and the Kalles theme storefront
  theme/       Kalles Liquid theme the API renders
  deploy/      docker-compose, nginx, .env.example
```

Public pages (shop, products, journal, legal, order success, robots, sitemap,
llms.txt, product photos) are served by the API theme. `site/` is no longer
required for that traffic. Apply routes with `sh deploy/apply-nginx-routes.sh`.
Stop the React container only after the checks in `deploy/stop-otrace-web.md`.

## Run it locally

```bash
cd site && npm install && npm run dev      # http://localhost:5180
```

## Build

```bash
cd site && npm run build                   # -> site/dist/public
```

The build copies `seo/llms.txt` and the other discovery files (`llms-full.txt`,
`identity.json`, `ai.txt`, `faq-ai.txt`, and the `.md` page mirrors) into the
site root, and writes `robots.txt` with the AI crawler lines. After the new
files are live on https://otrace.co, submit them to IndexNow (the API also
does this when it boots):

```bash
sh deploy/after-deploy.sh                  # node api/indexnow.js
```

SEO / AEO / GEO notes, the query research, and the change log live in `seo/`.

## Before it can take real money

1. Point the domain at the VPS and issue SSL.
2. Copy `deploy/.env.example` to `/opt/otrace/.env` on the server and fill it in.
   Generate the database passwords ON the server so they never travel.
3. Create the Stripe webhook for `checkout.session.completed` pointing at
   `https://<domain>/api/stripe/webhook`, and put the signing secret in `.env`.
4. Confirm the size chart (see the note in `site/src/lib/products.ts`) — four
   rows in the AW2026 spec sheet run backwards at L and are rendered as "—"
   rather than published wrong.
5. Retail prices live in two places and must match: `api/catalog.js`
   (authoritative) and `site/src/lib/products.ts` (display). Each piece is
   $80, reduced from $100. One hoodie and one sweatpant together are $140,
   reduced from $200.
6. List and fit capture. See `seo/LEAD-CAPTURE.md`. The API stores signups in
   MySQL either way. Set `KLAVIYO_PRIVATE_API_KEY` and `KLAVIYO_LIST_ID` on the
   API. Optional and blank by default: `KLAVIYO_COMPANY_ID` (onsite script, not
   the private key), `WHATSAPP_NUMBER` (E.164 digits, no plus;
   `PUBLIC_WHATSAPP_NUMBER` and `VITE_WHATSAPP_NUMBER` are aliases),
   `INSTAGRAM_URL` or `VITE_INSTAGRAM` (a real URL or a bare handle),
   `CRISP_WEBSITE_ID`, or `TAWK_PROPERTY_ID` plus `TAWK_WIDGET_ID`. Empty
   values hide the control. None of them are invented in the repo.
   `GA_MEASUREMENT_ID` (alias `OTRACE_GA_MEASUREMENT_ID`, only if the first is
   blank) loads one GA4 gtag as the first child of `<head>` on every theme
   page. `CLARITY_PROJECT_ID` (alias `OTRACE_CLARITY_PROJECT_ID`) loads one
   Microsoft Clarity script in that same slot, after the gtag when both are
   set. Blank emits nothing. Production for https://otrace.co is
   `GA_MEASUREMENT_ID=G-KZZXSSF3L1` and `CLARITY_PROJECT_ID=z3xvl8jv8y`.
   After changing either, rebuild the api container only.

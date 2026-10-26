# OTRACE — AW2026

A separate project from `southern-heritage-co`. Nothing is shared between them:
own folder, own dependencies, own database, own Stripe account.

```
otrace/
  assets/      source imagery + the scripts that generated and processed it
  site/        React + Vite storefront (mobile-first)
  api/         Express + Stripe + MySQL backend
  deploy/      docker-compose, nginx, .env.example
```

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
   API, then rebuild the storefront with `VITE_WHATSAPP_NUMBER` (E.164 digits,
   no plus; `PUBLIC_WHATSAPP_NUMBER` is an alias) and `VITE_INSTAGRAM` (or
   `VITE_INSTAGRAM_URL`) only when those are real. If the WhatsApp number is
   unset, the “Ask about fit” button is hidden. If Instagram is unset, the
   footer icon is hidden. Neither is invented in the repo.

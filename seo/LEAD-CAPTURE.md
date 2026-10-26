# Lead capture

The storefront collects an email (and, optionally, a phone) and the API writes a row in MySQL. Klaviyo receives the same signup only when both `KLAVIYO_PRIVATE_API_KEY` and `KLAVIYO_LIST_ID` are set on the API process. If either is missing, the API logs:

`[klaviyo] ESP sync skipped — KLAVIYO_PRIVATE_API_KEY or KLAVIYO_LIST_ID unset. Lead stored in MySQL only.`

The site does not send the three-email sequence below. Those emails are a Klaviyo Flow. Paste them in Klaviyo. The only message this app sends on signup is the existing one-note SMTP welcome in `api/emails.js` (`welcomeEmail`), and only when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASSWORD` are set. If SMTP is unset, that note is skipped too.

## Env vars

Set these on the API (see `deploy/.env.example` and `deploy/docker-compose.yml`):

| Name | Required for | Notes |
| --- | --- | --- |
| `KLAVIYO_PRIVATE_API_KEY` | Klaviyo sync | Private key, `pk_...`. Not the public site id. |
| `KLAVIYO_LIST_ID` | Klaviyo sync | The list people join. |

Set these when **building** the storefront. Vite inlines them. Changing them on the server later does nothing until the next `npm run build`. Leave them blank to hide the control.

| Name | Shows | Notes |
| --- | --- | --- |
| `VITE_WHATSAPP_NUMBER` | “Ask about fit” and the footer WhatsApp link | E.164 digits, no plus, 8 to 15 digits. A short or empty value hides the button. |
| `PUBLIC_WHATSAPP_NUMBER` | same | Alias of `VITE_WHATSAPP_NUMBER`. `site/vite.config.ts` allows the `PUBLIC_` prefix so this name is inlined. Do not put secrets in `PUBLIC_` or `VITE_` vars. |
| `VITE_INSTAGRAM` | Footer Instagram icon and label | Full `https://` URL of a real account. |
| `VITE_INSTAGRAM_URL` | same | Alias of `VITE_INSTAGRAM`. |
| `VITE_TIKTOK` | Footer text link | Only if a real URL is set. |
| `VITE_PINTEREST` | Footer text link | Only if a real URL is set. |

No phone number and no social URL are committed. Nothing is invented when these are empty.

## What a signup stores

`POST /api/subscribe` and `POST /api/waitlist` (waitlist defaults `form_id` to `waitlist`):

- email
- source and `form_id` (`footer`, `popup-email`, `popup-phone`, `exit-intent`, `exit-intent-phone`, `waitlist`, `email-my-size`)
- path (the page, query string stripped)
- optional product slug, size, colour
- optional phone
- marketing consent time (UTC) and method
- `sms_consent` and `whatsapp_consent`, both false unless the request sends the flag. The boxes render unticked.

A repeat email updates size, colour, phone and form id. It does not send the SMTP welcome again. Marketing consent time stays as the first consent. SMS and WhatsApp flags only turn on; a later form does not switch them off.

`POST /api/contact` stores `inquiry_type`: `order`, `sizing`, `wholesale` (the form label is “Wholesale / custom / collab”), or `other`. The shop email includes that type when `SHOP_EMAIL` is set. Contact does not join the list.

Klaviyo profile properties, for segments: `page`, `product_slug`, `size`, `colour`, `form_id`, `source`, `sms_consent`, `whatsapp_consent`, and `whatsapp_phone` when WhatsApp consent is on. `phone_number` is sent only with SMS consent and a leading `+` E.164 number. The API does not guess a country code.

## Klaviyo list setup

1. Create a Klaviyo account and one list for this shop.
2. Open the list. The id is in the URL (`.../list/LISTID`) or under list settings.
3. Account → Settings → API keys → create a private key with list and profile write access.
4. Put the key and the list id in the API environment and restart the API.
5. In the list settings, turn on double opt-in if you want the EU/UK-safe confirm step. Klaviyo sends that confirm. This repo does not.
6. Flows → Create flow → trigger “Added to list” → choose this list.
7. Add three emails with a delay between them (a day or two is enough). Paste the copy below. Do not add a discount code. There isn’t one.
8. Submit a test address on the site. `/api/health` reports `klaviyo: configured` when both vars are set. The profile should show `form_id` and `page`.

Segment ideas once properties exist: `form_id` equals `waitlist`; `product_slug` equals `oversized-hoodie`; `size` equals a size you are about to cut.

## Flow copy to paste

Facts used here are already on the site: 450 GSM garment-dyed cotton fleece, Onyx Black and Warm Cream, oversized (usual size for that look, or size down for a cleaner line), free US shipping, in stock and shipped in 3–5 business days. Prices stay on the product page so this flow does not freeze a number. Drops are small and do not restock.

### 1 — Fit and the 450 GSM story

Subject: How the oversized fit sits

Preview: 450 GSM, garment dyed, and where to take your size.

Body:

You asked for the fit note.

The Oversized Hoodie is 450 GSM cotton fleece: heavyweight loopback, brushed on the inside, sewn first and dyed after. The colour sits in the seams. It comes in Onyx Black and Warm Cream. The Wide-Leg Sweatpant is the same fleece.

The cut is a full size large on purpose. It should sit roomy through the body, with a dropped shoulder, longer than a standard fit. Take your usual size for that look, or size down for a cleaner line. XS through 3XL, unisex. The flat measurements are on the size guide.

Button: Read the size guide
URL: https://otrace.co/sizing

Second link, in the body: https://otrace.co/blog/how-an-oversized-hoodie-should-fit

### 2 — The set

Subject: Same fleece, same dye lot

Preview: The hoodie and the sweatpant, worn together.

Body:

The hoodie and the sweatpant are cut from the same 450 GSM fleece and dyed in the same lot, so the black matches and the cream matches.

That is the set. There is no extra code and no sitewide discount. If you want both, they are on the shop page, in stock, with free delivery in the United States.

Button: Shop the set
URL: https://otrace.co/shop

### 3 — The next drop

Subject: You hear first

Preview: A note before the next drop. Nothing else.

Body:

Drops are small and they do not restock. You are on the list for a note before the next one, and only when there is something to say.

The current pieces are the Oversized Hoodie and the Wide-Leg Sweatpant. When a later drop is close, this is the list that hears first.

Button: See what is in now
URL: https://otrace.co/shop

Footer line for every send: Unsubscribe. Privacy: https://otrace.co/privacy

## Where the forms are

- Footer on every page, including home: email, consent line, link to `/privacy`.
- Popup about 8 seconds after load on home and content pages. Step 1 is email and the consent line. Step 2 is an optional phone, with separate unticked SMS and WhatsApp boxes. Offer is the fit guide and first access to the next drop, not a discount.
- The timed popup does not open on `/cart`, while the cart drawer is open, or on `/order/success`. Checkout payment is Stripe-hosted, so there is no payment step on this site.
- Exit intent (pointer leaving the top of the window) on `/product/...` and `/cart`, same offer, same cooldown.
- Dismiss writes `localStorage` key `otrace-lead-capture` and a `otrace_capture` cookie. Cooldown is 14 days. A “Fit guide” tab reopens it. A completed email hides it for a year.
- Product pages: “Notify me” for the selected size and colour, “Email me my size” (links to `/sizing` and the fit journal), and WhatsApp when the number is set.
- `/sizing`: “Email me my size” and WhatsApp when the number is set.
- `/contact`: inquiry type includes Wholesale / custom / collab. Business, quantity and timeline show for that type and are included in the message.

## Blocked on the owner

- `KLAVIYO_PRIVATE_API_KEY` and `KLAVIYO_LIST_ID`, then a restart of the API.
- Creating the Flow and pasting the three emails. Until that exists, Klaviyo will not send them, and this app will not either.
- Double opt-in toggle in Klaviyo, if you want it.
- `VITE_WHATSAPP_NUMBER` or `PUBLIC_WHATSAPP_NUMBER` at storefront build time, then a rebuild. Until then the WhatsApp button stays hidden.
- `VITE_INSTAGRAM` or `VITE_INSTAGRAM_URL` at build time for the footer icon. Until then it stays hidden.
- ManyChat (or any Instagram comment-to-DM tool) for the FIT and DROP keywords. That setup is outside this repo. Point FIT at https://otrace.co/sizing and DROP at the footer list. Instagram still needs a real account first.
- Deploy of this branch. Captures on https://otrace.co start only after the new API and the new storefront are live.
- SMS sending itself needs a registered sender (10DLC or toll-free) inside Klaviyo. The checkbox only records consent.

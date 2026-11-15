Card brand icons, self-hosted.

Source: github.com/activemerchant/payment_icons (MIT, see MIT-LICENSE.txt).
Downloaded 15 Nov 2026 and scanned for <script>, event handlers and external
references before being served from our own origin.

They were hotlinked from raw.githubusercontent.com until that date, on the
product page and in both cart views. raw.githubusercontent.com is not a CDN,
it rate-limits, and it put a third-party request on a checkout-adjacent page.

Only the six card brands Stripe settles for us are here. Do not add an icon
without adding its file: the theme builds the path from the name in
`block.settings.svg`, so a name with no file is a broken image, and a brand
we do not accept is a false claim at the point of payment.

/**
 * Creating the Stripe Checkout Session, in one place.
 *
 * Two routes start a checkout now - the React storefront's /api/checkout and
 * the Kalles theme's cart form - and a second copy of this would be a second
 * set of shipping rates, success URLs and metadata to keep in step. They would
 * drift quietly: nothing fails when one of them is wrong, a customer is simply
 * charged or shipped differently depending on which page they came from.
 */
import {
  CURRENCY,
  SHIPPING,
  buildLineItems,
  packItems,
  subtotalCents,
} from './catalog.js';

/**
 * Validate a basket and open a Stripe session for it.
 *
 * Returns `{ session }` on success or `{ error }` with a message fit to show a
 * customer - never a Stripe exception, which carries internals.
 */
export async function createCheckoutSession(stripe, items, { siteUrl }) {
  if (!stripe) {
    return { error: 'Payments are not configured yet. Please try again shortly.', status: 503 };
  }

  const { lineItems, normalised, errors } = buildLineItems(items, { siteUrl });
  if (errors.length || lineItems.length === 0) {
    return { error: errors[0] ?? 'Your cart is empty.', status: 400 };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart`,
    billing_address_collection: 'required',
    shipping_address_collection: { allowed_countries: ['US'] },
    phone_number_collection: { enabled: true },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: SHIPPING.label,
          fixed_amount: { amount: SHIPPING.amountCents, currency: CURRENCY },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: SHIPPING.minDays },
            maximum: { unit: 'business_day', value: SHIPPING.maxDays },
          },
        },
      },
    ],
    // packItems keeps every value inside Stripe's 500-character metadata cap.
    metadata: {
      ...packItems(normalised),
      subtotal_cents: String(subtotalCents(normalised)),
    },
  });

  return { session, normalised };
}

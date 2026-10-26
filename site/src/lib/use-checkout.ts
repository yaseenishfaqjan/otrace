import { useState } from 'react';
import { useCart } from '@/lib/cart';
import { postJson, ApiError } from '@/lib/api';

/**
 * Starts a Stripe Checkout Session for whatever is in the cart. Shared by the
 * cart drawer and the cart page so there is exactly one place that knows the
 * request shape. Only SKU, size, colour and quantity are sent — the server
 * resolves the price, so a tampered bundle cannot change what is charged.
 */
export function useCheckout() {
  const { items } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    if (isCheckingOut || items.length === 0) return;
    setIsCheckingOut(true);
    setError(null);

    try {
      const data = await postJson<{ url?: string }>('/api/checkout', {
        items: items.map((i) => ({
          sku: i.sku,
          size: i.size,
          colour: i.colour,
          quantity: i.quantity,
        })),
      });

      if (!data.url) throw new ApiError('Checkout could not start. Please try again.', 500);
      window.location.href = data.url;
    } catch (err) {
      // Only reset on failure — on success the page is already navigating, and
      // flipping the button back to idle invites a second Stripe session.
      setIsCheckingOut(false);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return { checkout, isCheckingOut, error };
}

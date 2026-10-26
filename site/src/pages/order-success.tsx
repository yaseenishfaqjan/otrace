import { useEffect } from 'react';
import { Link } from 'wouter';
import { Check } from 'lucide-react';
import { useCart } from '@/lib/cart';

import { usePageMeta } from '@/lib/use-page-meta';
export default function OrderSuccess() {
  usePageMeta('Order confirmed', undefined, { noindex: true });
  const { clearCart } = useCart();

  // Stripe has taken the payment by the time this renders, so the cart has
  // served its purpose. Leaving it full invites an accidental second order.
  useEffect(() => { clearCart(); }, [clearCart]);

  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center">
      <div className="shell py-24 max-w-2xl">
        <div className="w-12 h-12 border border-cream grid place-items-center mb-8">
          <Check className="w-5 h-5 text-cream" strokeWidth={2} />
        </div>
        <p className="eyebrow text-muted mb-4">Order confirmed</p>
        <h1 className="display text-cream text-[10vw] md:text-[4rem]">Thank<br />you</h1>
        <p className="text-cream-dim leading-relaxed mt-7">
          Your order is in. A confirmation with your receipt is on its way to
          your inbox now, and we email tracking the moment it ships.
        </p>
        <p className="text-cream-dim leading-relaxed mt-4">
          In-stock orders ship within 3–5 business days. We email tracking the
          moment the parcel leaves us.
        </p>
        <div className="flex flex-wrap gap-3 mt-9">
          <Link href="/shop" className="btn">Keep shopping</Link>
          <Link href="/account" className="btn-ghost">Your orders</Link>
        </div>
      </div>
    </div>
  );
}

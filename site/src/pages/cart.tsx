import { Link } from 'wouter';
import { Plus, Minus } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCheckout } from '@/lib/use-checkout';
import { money, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';

import { usePageMeta } from '@/lib/use-page-meta';
export default function Cart() {
  usePageMeta('Cart', undefined, { noindex: true });
  const { items, updateQuantity, removeItem, subtotal, itemCount } = useCart();
  const { checkout, isCheckingOut, error } = useCheckout();

  const slugFor = (sku: string) => PRODUCTS.find((p) => p.sku === sku)?.slug ?? '';

  if (items.length === 0) {
    return (
      <div className="pt-16 md:pt-20">
        <div className="shell py-24 md:py-32">
          <h1 className="display text-cream text-[11.5vw] md:text-[4.5rem]">Your cart<br />is empty</h1>
          <p className="text-cream-dim mt-6 max-w-md leading-relaxed">
            Two pieces, two colorways. Take a look at what is in the drop.
          </p>
          <Link href="/shop" className="btn mt-9">Shop AW2026</Link>
        </div>
        <div className="shell pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-12 md:gap-x-8">
            {PRODUCTS.map((p, i) => <ProductCard key={p.slug} product={p} heading="h2" priority={i === 0} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16">
        <h1 className="display text-cream text-[9.5vw] md:text-[3.5rem] mb-10">Cart</h1>

        <div className="grid lg:grid-cols-3 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-2">
            {items.map((item) => (
              <div key={item.id} className="flex gap-5 py-7 border-t border-line">
                <Link href={`/product/${slugFor(item.sku)}`} className="w-28 sm:w-32 shrink-0 bg-charcoal/30 aspect-[4/5] overflow-hidden">
                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                </Link>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex justify-between gap-4">
                    <Link href={`/product/${slugFor(item.sku)}`} className="text-cream font-medium leading-tight hover:text-cream-dim transition-colors">
                      {item.name}
                    </Link>
                    <span className="text-cream tabular-nums shrink-0">{money(item.price * item.quantity)}</span>
                  </div>
                  <p className="text-muted text-sm mt-1.5">{item.colour} · {item.size}</p>
                  {item.shipsIn && (
                    <p className="text-cream-dim text-xs mt-1">Pre-order · ships in {item.shipsIn}</p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-5">
                    <div className="flex items-center border border-line">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`} className="w-10 h-10 grid place-items-center text-cream-dim hover:text-cream transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-9 text-center text-cream text-sm tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`} className="w-10 h-10 grid place-items-center text-cream-dim hover:text-cream transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-muted hover:text-cream text-xs underline underline-offset-4 transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="border border-line p-6 md:p-8 lg:sticky lg:top-28">
            <h2 className="eyebrow text-cream mb-6">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-cream-dim">Subtotal ({itemCount})</span>
              <span className="text-cream tabular-nums">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mt-3">
              <span className="text-cream-dim">Delivery</span>
              <span className="text-cream">Free</span>
            </div>
            <div className="flex justify-between items-baseline mt-6 pt-5 border-t border-line">
              <span className="eyebrow text-cream">Total</span>
              <span className="text-cream text-2xl tabular-nums">{money(subtotal)}</span>
            </div>
            <p className="text-muted text-xs mt-3">Taxes calculated at checkout.</p>
            {items.some((i) => i.shipsIn) && (
              <p className="text-cream-dim text-xs mt-3 leading-relaxed">
                Your card is charged today to reserve your size. Pre-orders can be
                cancelled any time before they ship.
              </p>
            )}

            {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

            <button onClick={checkout} disabled={isCheckingOut} className="btn w-full mt-6">
              {isCheckingOut ? 'Taking you to payment' : 'Checkout'}
            </button>
            <p className="text-muted text-[11px] text-center mt-4 leading-relaxed">
              Secure payment by Stripe. Cards, Apple Pay and Google Pay accepted.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

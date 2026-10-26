import { useEffect } from 'react';
import { Link } from 'wouter';
import { X, Plus, Minus } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCheckout } from '@/lib/use-checkout';
import { money } from '@/lib/products';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

/**
 * Slide-out cart. Opens itself whenever something is added, because "added to
 * cart" and "how do I pay" have to be the same moment — otherwise a customer
 * who does not know the cart icon exists is left holding a full cart.
 */
export function CartDrawer() {
  const { items, isCartOpen, closeCart, updateQuantity, removeItem, subtotal, itemCount } = useCart();
  const { checkout, isCheckingOut, error } = useCheckout();

  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Cart">
      <button
        className="absolute inset-0 bg-onyx/80 backdrop-blur-sm fade"
        onClick={closeCart}
        aria-label="Close cart"
        tabIndex={-1}
      />

      <div className="relative w-full sm:max-w-md bg-onyx-lift h-full flex flex-col border-l border-line rise">
        <div className="flex items-center justify-between px-6 h-16 border-b border-line shrink-0">
          <span className="eyebrow text-cream">
            {items.length === 0 ? 'Cart' : `Cart (${itemCount})`}
          </span>
          <button onClick={closeCart} aria-label="Close cart" className="-mr-2 p-2 text-cream-dim hover:text-cream transition-colors">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
            <p className="display text-cream text-3xl">Nothing<br />in here yet</p>
            <Link href="/shop" onClick={closeCart} className="btn">Shop AW2026</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-7">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <Link
                    href={`/product/${item.sku === 'OT-HOOD' ? 'oversized-hoodie' : 'wide-leg-sweatpant'}`}
                    onClick={closeCart}
                    className="w-24 shrink-0 bg-charcoal/40 aspect-[4/5] overflow-hidden"
                  >
                    <SiteImage
                      src={item.image}
                      alt=""
                      width={imageSize(item.image).width}
                      height={imageSize(item.image).height}
                      pictureClassName="block w-full h-full"
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between gap-3">
                      <span className="text-cream text-sm font-medium leading-tight">{item.name}</span>
                      <span className="text-cream text-sm tabular-nums shrink-0">
                        {money(item.price * item.quantity)}
                      </span>
                    </div>
                    <span className="text-muted text-xs mt-1">
                      {item.colour} · {item.size}
                    </span>
                    {item.shipsIn && (
                      <span className="text-cream-dim text-[11px] mt-1">
                        Pre-order · ships in {item.shipsIn}
                      </span>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4">
                      <div className="flex items-center border border-line">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="w-9 h-9 grid place-items-center text-cream-dim hover:text-cream transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-cream text-sm tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="w-9 h-9 grid place-items-center text-cream-dim hover:text-cream transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted hover:text-cream text-xs underline underline-offset-4 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-6 py-6 shrink-0">
              <div className="flex justify-between items-baseline">
                <span className="eyebrow text-muted">Subtotal</span>
                <span className="text-cream text-xl tabular-nums">{money(subtotal)}</span>
              </div>
              <p className="text-muted text-xs mt-2">
                Taxes calculated at checkout. Delivery is on us.
              </p>
              {items.some((i) => i.shipsIn) && (
                <p className="text-cream-dim text-xs mt-3 leading-relaxed">
                  Your card is charged today to reserve your size. Pre-orders can
                  be cancelled any time before they ship.
                </p>
              )}

              {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

              <button onClick={checkout} disabled={isCheckingOut} className="btn w-full mt-5">
                {isCheckingOut ? 'Taking you to payment' : 'Checkout'}
              </button>
              {/* The drawer is where most people pay, and it said nothing
                  about how. Silence at the moment of handing over a card is
                  where hesitation comes from. */}
              <p className="text-muted text-[11px] text-center mt-4 leading-relaxed">
                Secure payment by Stripe. Cards, Apple&nbsp;Pay and Google&nbsp;Pay.
              </p>
              <button onClick={closeCart} className="w-full text-center eyebrow text-muted hover:text-cream transition-colors mt-4">
                Continue shopping
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

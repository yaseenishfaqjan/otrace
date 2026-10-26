import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getProductBySku } from '@/lib/products';

export type CartItem = {
  /** sku + colorway + size — see the note in addItem. */
  id: string;
  sku: string;
  name: string;
  price: number;
  size: string;
  colour: string;
  quantity: number;
  image: string;
  /** Ship window when the piece was bought ahead of production. */
  shipsIn?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = 'otrace-cart';

/**
 * The cart as the browser last saved it, re-priced against the live catalogue.
 * Called after mount, never during the first render — see CartProvider.
 */
function readSavedCart(): CartItem[] {
  try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed: CartItem[] = saved ? JSON.parse(saved) : [];

      // A cart lives in the browser for weeks, so a saved line outlives the
      // price it was added at — the customer would see one total and be charged
      // another, because the server prices from its own catalogue. Re-resolve
      // every line, and drop anything we no longer sell so a stale cart cannot
      // block checkout with "unknown product".
      return parsed.flatMap((item) => {
        const product = getProductBySku(item.sku);
        if (!product) return [];
        // Re-resolve the pre-order window too — a piece can come into stock
        // while it is still sitting in someone's cart.
        return [{
          ...item,
          name: product.name,
          price: product.price,
          shipsIn: product.preorder?.shipsIn,
        }];
      });
    } catch {
      return [];
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Starts empty on purpose. Every page is prerendered with an empty cart, so
  // restoring the saved one during the first render makes React's output
  // disagree with the HTML it was handed — it then throws the whole page away
  // and rebuilds it (hydration error #418), and a returning customer watches
  // "your cart is empty" flash before their items appear. Restoring one frame
  // later costs nothing and matches the HTML exactly.
  const [items, setItems] = useState<CartItem[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setItems(readSavedCart());
    setRestored(true);
  }, []);

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    // Never before the restore has run: the empty first render would write an
    // empty cart over the one the customer actually has.
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* private mode — the cart simply will not survive a reload */
    }
  }, [items, restored]);

  const addItem = (newItem: Omit<CartItem, 'id'>) => {
    // Opening the drawer IS the confirmation. A toast that fades in four
    // seconds leaves people holding a full cart with no visible way to pay.
    setIsCartOpen(true);
    setItems((current) => {
      // The line identity must include the colorway, or Onyx-L and Cream-L
      // merge into one row and the customer is shipped whichever was added
      // first.
      const id = [newItem.sku, newItem.colour, newItem.size].filter(Boolean).join('-');
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + newItem.quantity } : item,
        );
      }
      return [...current, { ...newItem, id }];
    });
  };

  const removeItem = (id: string) => setItems((c) => c.filter((i) => i.id !== id));

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((c) => c.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  // Stable identity, and a no-op when the cart is already empty. Recreated on
  // every render, it trapped /order/success - the page a customer sees right
  // after paying - in an endless loop: effect -> setItems([]) -> re-render ->
  // new clearCart -> effect again. A fresh [] is a new reference, so even an
  // empty cart re-rendered every time.
  const clearCart = useCallback(() => setItems((c) => (c.length ? [] : c)), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, updateQuantity, clearCart,
        itemCount, subtotal, isCartOpen, openCart, closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

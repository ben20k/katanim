import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { effectivePrice } from '../lib/format';

const CartContext = createContext(null);
const KEY = 'katanim_cart_v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  const api = useMemo(() => {
    const add = (product, qty = 1) =>
      setItems((prev) => {
        const found = prev.find((i) => i.product_id === product.id);
        if (found) {
          return prev.map((i) =>
            i.product_id === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i,
          );
        }
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            unit: product.unit,
            image_url: product.image_url,
            price: effectivePrice(product),
            stock: product.stock,
            qty: Math.min(qty, product.stock),
          },
        ];
      });

    const update = (productId, qty) =>
      setItems((prev) =>
        prev.map((i) => (i.product_id === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock || qty)) } : i)),
      );

    const remove = (productId) => setItems((prev) => prev.filter((i) => i.product_id !== productId));
    const clear = () => setItems([]);

    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

    return { items, add, update, remove, clear, count, subtotal };
  }, [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

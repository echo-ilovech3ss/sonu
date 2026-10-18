import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CartLine } from '../../shared/types';
import { useStore } from './store';

const CART_KEY = 'sonu.cart.v1';

interface CartContextValue {
  lines: CartLine[];
  cartCount: number;
  subtotalCents: number;
  isCartOpen: boolean;
  addLine: (line: CartLine) => void;
  setQuantity: (productId: string, size: number, quantity: number) => void;
  removeLine: (productId: string, size: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line) =>
        typeof line?.productId === 'string' &&
        Number.isInteger(line?.size) &&
        Number.isInteger(line?.quantity) &&
        line.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { products } = useStore();
  const [lines, setLines] = useState<CartLine[]>(readCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      // The bag still works for this session if storage is unavailable.
    }
  }, [lines]);

  const addLine = useCallback(
    (line: CartLine) => {
      const product = products.find((entry) => entry.id === line.productId);
      const stock = product?.stock[String(line.size)] ?? 0;
      const cap = Math.min(5, stock);
      if (cap <= 0) return;

      setLines((current) => {
        const existing = current.find(
          (entry) =>
            entry.productId === line.productId && entry.size === line.size,
        );

        if (existing) {
          return current.map((entry) =>
            entry.productId === line.productId && entry.size === line.size
              ? {
                  ...entry,
                  quantity: Math.min(entry.quantity + line.quantity, cap),
                }
              : entry,
          );
        }

        return [...current, { ...line, quantity: Math.min(line.quantity, cap) }];
      });
    },
    [products],
  );

  const setQuantity = useCallback(
    (productId: string, size: number, quantity: number) => {
      const product = products.find((entry) => entry.id === productId);
      const cap = Math.min(5, product?.stock[String(size)] ?? 0);
      setLines((current) =>
        current
          .map((entry) =>
            entry.productId === productId && entry.size === size
              ? { ...entry, quantity: Math.max(0, Math.min(quantity, cap)) }
              : entry,
          )
          .filter((entry) => entry.quantity > 0),
      );
    },
    [products],
  );

  const removeLine = useCallback((productId: string, size: number) => {
    setLines((current) =>
      current.filter(
        (entry) => !(entry.productId === productId && entry.size === size),
      ),
    );
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const openCart = useCallback(() => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
    window.setTimeout(() => lastFocus.current?.focus(), 0);
  }, []);

  const cartCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = lines.reduce((sum, line) => {
    const product = products.find((entry) => entry.id === line.productId);
    return sum + (product?.priceCents ?? 0) * line.quantity;
  }, 0);

  const value = useMemo(
    () => ({
      lines,
      cartCount,
      subtotalCents,
      isCartOpen,
      addLine,
      setQuantity,
      removeLine,
      clearCart,
      openCart,
      closeCart,
    }),
    [
      lines,
      cartCount,
      subtotalCents,
      isCartOpen,
      addLine,
      setQuantity,
      removeLine,
      clearCart,
      openCart,
      closeCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}

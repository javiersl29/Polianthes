"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  CartItem,
  loadCart,
  saveCart,
  clearCartStorage,
  addItem as addItemHelper,
  updateQty as updateQtyHelper,
  removeItem as removeItemHelper,
  cartTotal
} from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  total: ReturnType<typeof cartTotal>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: CartItem) => void;
  setQty: (slug: string, size_ml: number, qty: number) => void;
  remove: (slug: string, size_ml: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar al montar
  useEffect(() => {
    setItems(loadCart());
    // Escuchar cambios desde otras pestañas / componentes
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CartItem[]>).detail;
      if (Array.isArray(detail)) setItems(detail);
      else setItems(loadCart());
    };
    window.addEventListener("polianthes:cart", handler as EventListener);
    window.addEventListener("storage", (e) => {
      if (e.key === "polianthes_cart_v1") setItems(loadCart());
    });
    return () => window.removeEventListener("polianthes:cart", handler as EventListener);
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    saveCart(next);
  }, []);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const next = addItemHelper(prev, item);
      saveCart(next);
      return next;
    });
    setIsOpen(true);
  }, []);

  const setQty = useCallback((slug: string, size_ml: number, qty: number) => {
    setItems((prev) => {
      const next = updateQtyHelper(prev, slug, size_ml, qty);
      saveCart(next);
      return next;
    });
  }, []);

  const remove = useCallback((slug: string, size_ml: number) => {
    setItems((prev) => {
      const next = removeItemHelper(prev, slug, size_ml);
      saveCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    clearCartStorage();
  }, []);

  const value: CartContextValue = {
    items,
    total: cartTotal(items),
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((o) => !o),
    add,
    setQty,
    remove,
    clear
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

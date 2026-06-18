"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  CartItem,
  CartPromo,
  loadCart,
  loadCartPromo,
  saveCart,
  saveCartPromo,
  clearCartStorage,
  addItem as addItemHelper,
  updateQty as updateQtyHelper,
  removeItem as removeItemHelper,
  cartTotal
} from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  promo: CartPromo | null;
  total: ReturnType<typeof cartTotal>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: CartItem) => void;
  setQty: (slug: string, size_ml: number, qty: number) => void;
  remove: (slug: string, size_ml: number) => void;
  clear: () => void;
  setPromo: (promo: CartPromo | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promo, setPromoState] = useState<CartPromo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar al montar
  useEffect(() => {
    setItems(loadCart());
    setPromoState(loadCartPromo());
    const cartHandler = (e: Event) => {
      const detail = (e as CustomEvent<CartItem[]>).detail;
      if (Array.isArray(detail)) setItems(detail);
      else setItems(loadCart());
    };
    const promoHandler = (e: Event) => {
      const detail = (e as CustomEvent<CartPromo | null>).detail;
      setPromoState(detail ?? null);
    };
    window.addEventListener("polianthes:cart", cartHandler as EventListener);
    window.addEventListener("polianthes:cart-promo", promoHandler as EventListener);
    window.addEventListener("storage", (e) => {
      if (e.key === "polianthes_cart_v1") setItems(loadCart());
      if (e.key === "polianthes_cart_promo_v1") setPromoState(loadCartPromo());
    });
    return () => {
      window.removeEventListener("polianthes:cart", cartHandler as EventListener);
      window.removeEventListener("polianthes:cart-promo", promoHandler as EventListener);
    };
  }, []);

  const setPromo = useCallback((p: CartPromo | null) => {
    setPromoState(p);
    saveCartPromo(p);
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
    setPromoState(null);
    clearCartStorage();
  }, []);

  const value: CartContextValue = {
    items,
    promo,
    total: cartTotal(items, promo),
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((o) => !o),
    add,
    setQty,
    remove,
    clear,
    setPromo
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

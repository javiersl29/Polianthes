"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
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
import { findBestSinglePromo, validatePromoForItems, type ActivePromotion, type RankedPromo } from "@/lib/promo-match";

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
  /** Mejor promo sugerida si la actual no es óptima */
  suggestedPromo: RankedPromo | null;
  /** Aplicar la promo sugerida */
  applySuggested: () => void;
  /** Descartar la sugerencia (no mostrar banner de nuevo hasta que cambien los items) */
  dismissSuggestion: () => void;
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
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);
  const [suggestedPromo, setSuggestedPromo] = useState<RankedPromo | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const autoAppliedRef = useRef(false);

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

  // Cargar promociones activas (una sola vez + refresh cada 5 min)
  useEffect(() => {
    let cancelled = false;
    async function loadPromotions() {
      try {
        const r = await fetch("/api/public/promotions");
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && Array.isArray(data.promotions)) {
          setActivePromotions(data.promotions);
        }
      } catch { /* noop */ }
    }
    loadPromotions();
    const interval = setInterval(loadPromotions, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Auto-detección de promos (debounced)
  useEffect(() => {
    if (items.length === 0 || activePromotions.length === 0) {
      setSuggestedPromo(null);
      return;
    }

    const t = setTimeout(() => {
      const promoItems = items.map((it) => ({
        size_ml: it.size_ml,
        qty: it.qty,
        unit_price_cents: it.unit_price_cents,
      }));

      const best = findBestSinglePromo(promoItems, activePromotions);

      // CASO 1: No hay promo en el carrito → auto-aplicar la mejor
      if (!promo) {
        if (best && best.discount_cents > 0) {
          // Evitar re-aplicar si ya fue aplicada automáticamente
          if (!autoAppliedRef.current) {
            autoAppliedRef.current = true;
            const cartPromo: CartPromo = {
              slug: best.slug,
              type: best.type as CartPromo["type"],
              title: best.title,
              source: "auto",
              ...promoConfigFromActive(best.source),
            };
            setPromoState(cartPromo);
            saveCartPromo(cartPromo);
          }
        }
        setSuggestedPromo(null);
        return;
      }

      // CASO 2: Hay promo 'auto' → re-evaluar si sigue siendo la mejor
      if (promo.source === "auto") {
        // Si la mejor promo cambió, actualizar
        if (best && best.slug !== promo.slug && best.discount_cents > 0) {
          const cartPromo: CartPromo = {
            slug: best.slug,
            type: best.type as CartPromo["type"],
            title: best.title,
            source: "auto",
            ...promoConfigFromActive(best.source),
          };
          setPromoState(cartPromo);
          saveCartPromo(cartPromo);
        } else if (!best || best.discount_cents <= 0) {
          // La promo auto ya no aplica → limpiar
          setPromoState(null);
          saveCartPromo(null);
        }
        setSuggestedPromo(null);
        return;
      }

      // CASO 3: Hay promo 'user' (explícita) → validar que siga aplicando
      // Si la promo del usuario sigue siendo válida, respetarla
      // Si ya no aplica pero hay una mejor, sugerirla
      const userPromoActive = activePromotions.find((p) => p.slug === promo.slug);
      if (userPromoActive) {
        const validation = validatePromoForItems(promoItems, userPromoActive);
        if (!validation.valid) {
          // La promo del usuario ya no aplica → limpiar y sugerir
          setPromoState(null);
          saveCartPromo(null);
          if (best && best.discount_cents > 0 && dismissedRef.current !== best.slug) {
            setSuggestedPromo(best);
          }
        }
      } else {
        // La promo del usuario ya no existe o está inactiva → limpiar
        setPromoState(null);
        saveCartPromo(null);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [items, promo, activePromotions]);

  const setPromo = useCallback((p: CartPromo | null) => {
    setPromoState(p);
    saveCartPromo(p);
    autoAppliedRef.current = false; // reset para que el auto-detect no re-aplique
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
    setSuggestedPromo(null);
    autoAppliedRef.current = false;
    clearCartStorage();
  }, []);

  const applySuggested = useCallback(() => {
    if (!suggestedPromo) return;
    const cartPromo: CartPromo = {
      slug: suggestedPromo.slug,
      type: suggestedPromo.type as CartPromo["type"],
      title: suggestedPromo.title,
      source: "user",
      ...promoConfigFromActive(suggestedPromo.source),
    };
    setPromoState(cartPromo);
    saveCartPromo(cartPromo);
    setSuggestedPromo(null);
  }, [suggestedPromo]);

  const dismissSuggestion = useCallback(() => {
    if (suggestedPromo) dismissedRef.current = suggestedPromo.slug;
    setSuggestedPromo(null);
  }, [suggestedPromo]);

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
    setPromo,
    suggestedPromo,
    applySuggested,
    dismissSuggestion,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Convierte una ActivePromotion a los campos de CartPromo relevantes.
 */
function promoConfigFromActive(p: ActivePromotion): Partial<CartPromo> {
  return {
    quantity_to_take: p.quantity_to_take,
    bundle_price_cents: p.bundle_price_cents,
    value: p.value,
    mix_sizes: p.mix_sizes,
    required_size_ml: p.required_size_ml ?? undefined,
    mix_config: p.mix_config ?? undefined,
  };
}

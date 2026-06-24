/**
 * Tipos y helpers del carrito de compras.
 * El estado se mantiene en localStorage (persistente entre sesiones)
 * y se sincroniza con un Context provider en client.
 */

import { calculatePromo } from "@/lib/promo-calc";

export type CartItem = {
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  artistic_name: string | null;
  size_ml: number;
  qty: number;
  unit_price_cents: number;
  image_url: string | null;
  image_version: number | null;
};

export type CartPromo = {
  slug: string;
  type: "bundle_qty" | "bundle_mix" | "3x2" | "2x1" | "percent" | "fixed" | "free_shipping" | "second_unit" | "bundle" | "tiered";
  title: string;
  /** Cantidad de unidades que incluye el bundle (ej 3 para "3 por $X") */
  quantity_to_take?: number;
  /** Precio fijo del bundle en centavos */
  bundle_price_cents?: number;
  /** % de descuento */
  value?: number;
  /** Si true, se permite mezclar tamaños en bundle_qty */
  mix_sizes?: boolean;
  /** Tamaño requerido para bundle_qty (ej. 10 para "3 × 10ml por $290") */
  required_size_ml?: number;
  /** Configuración de bundle mixto: array de {size_ml, qty} */
  mix_config?: Array<{ size_ml: number; qty: number }>;
  /** Origen: 'user' = elegida explícitamente desde landing, 'auto' = detectada automáticamente */
  source?: "user" | "auto";
};

const CART_KEY = "polianthes_cart_v1";
const CART_PROMO_KEY = "polianthes_cart_promo_v1";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

export function loadCartPromo(): CartPromo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_PROMO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartPromo;
  } catch {
    return null;
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("polianthes:cart", { detail: items }));
  } catch { /* noop */ }
}

export function saveCartPromo(promo: CartPromo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (promo) {
      window.localStorage.setItem(CART_PROMO_KEY, JSON.stringify(promo));
    } else {
      window.localStorage.removeItem(CART_PROMO_KEY);
    }
    window.dispatchEvent(new CustomEvent("polianthes:cart-promo", { detail: promo }));
  } catch { /* noop */ }
}

export function clearCartStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_KEY);
    window.localStorage.removeItem(CART_PROMO_KEY);
    window.dispatchEvent(new CustomEvent("polianthes:cart", { detail: [] }));
    window.dispatchEvent(new CustomEvent("polianthes:cart-promo", { detail: null }));
  } catch { /* noop */ }
}

function isValidItem(x: unknown): x is CartItem {
  if (!x || typeof x !== "object") return false;
  const it = x as Record<string, unknown>;
  return (
    typeof it.slug === "string" &&
    typeof it.size_ml === "number" &&
    typeof it.qty === "number" &&
    typeof it.unit_price_cents === "number"
  );
}

export type CartTotals = {
  total_cents: number;
  units: number;
  distinct: number;
  subtotal_cents: number;
  discount_cents: number;
  promo: CartPromo | null;
};

/**
 * Suma todos los items y aplica promo activa si existe.
 * Delega el cálculo a lib/promo-calc.ts para consistencia cliente↔servidor.
 */
export function cartTotal(items: CartItem[], promo: CartPromo | null = null): CartTotals {
  let subtotal = 0;
  let units = 0;
  for (const it of items) {
    subtotal += it.unit_price_cents * it.qty;
    units += it.qty;
  }

  if (!promo || units === 0) {
    return {
      total_cents: subtotal,
      subtotal_cents: subtotal,
      discount_cents: 0,
      units,
      distinct: items.length,
      promo,
    };
  }

  const result = calculatePromo(
    items.map((it) => ({ size_ml: it.size_ml, qty: it.qty, unit_price_cents: it.unit_price_cents })),
    {
      type: promo.type,
      value: promo.value ?? 0,
      bundle_price_cents: promo.bundle_price_cents ?? 0,
      quantity_to_take: promo.quantity_to_take ?? 0,
      quantity_to_pay: 0,
      min_subtotal_cents: 0,
      mix_config: promo.mix_config ?? null,
      required_size_ml: promo.required_size_ml,
      mix_sizes: promo.mix_sizes,
    }
  );

  return {
    total_cents: result.total_cents,
    subtotal_cents: result.subtotal_cents,
    discount_cents: result.discount_cents,
    units,
    distinct: items.length,
    promo,
  };
}

/**
 * Combina items duplicados (mismo slug + size) sumando qty.
 */
export function addItem(items: CartItem[], item: CartItem): CartItem[] {
  const idx = items.findIndex(
    (i) => i.slug === item.slug && i.size_ml === item.size_ml
  );
  if (idx === -1) return [...items, item];
  const next = [...items];
  next[idx] = {
    ...next[idx],
    qty: Math.min(99, next[idx].qty + item.qty)
  };
  return next;
}

export function updateQty(items: CartItem[], slug: string, size_ml: number, qty: number): CartItem[] {
  return items
    .map((it) =>
      it.slug === slug && it.size_ml === size_ml
        ? { ...it, qty: Math.max(0, Math.min(99, qty)) }
        : it
    )
    .filter((it) => it.qty > 0);
}

export function removeItem(items: CartItem[], slug: string, size_ml: number): CartItem[] {
  return items.filter((it) => !(it.slug === slug && it.size_ml === size_ml));
}

export function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

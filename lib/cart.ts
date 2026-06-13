/**
 * Tipos y helpers del carrito de compras.
 * El estado se mantiene en localStorage (persistente entre sesiones)
 * y se sincroniza con un Context provider en client.
 */

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

const CART_KEY = "polianthes_cart_v1";

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

export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    // Disparar evento custom para que otros componentes (drawer, navbar) se enteren
    window.dispatchEvent(new CustomEvent("polianthes:cart", { detail: items }));
  } catch {
    /* storage lleno o privado */
  }
}

export function clearCartStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new CustomEvent("polianthes:cart", { detail: [] }));
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

/**
 * Suma todos los items y devuelve { items, total_cents, units }.
 */
export function cartTotal(items: CartItem[]): {
  total_cents: number;
  units: number;
  distinct: number;
} {
  let total = 0;
  let units = 0;
  for (const it of items) {
    total += it.unit_price_cents * it.qty;
    units += it.qty;
  }
  return { total_cents: total, units, distinct: items.length };
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

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
  /** Configuración de bundle mixto: array de {size_ml, qty} */
  mix_config?: Array<{ size_ml: number; qty: number }>;
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
    // Disparar evento custom para que otros componentes (drawer, navbar) se enteren
    window.dispatchEvent(new CustomEvent("polianthes:cart", { detail: items }));
  } catch {
    /* storage lleno o privado */
  }
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
  } catch {
    /* noop */
  }
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
 * Para bundle_qty: si hay N+ unidades y el promo aplica, cobra bundle_price_cents por grupo.
 */
export function cartTotal(items: CartItem[], promo: CartPromo | null = null): CartTotals {
  let subtotal = 0;
  let units = 0;
  for (const it of items) {
    subtotal += it.unit_price_cents * it.qty;
    units += it.qty;
  }

  let total = subtotal;
  let discount = 0;

  if (promo && units > 0) {
    if (promo.type === "bundle_qty" && promo.bundle_price_cents && promo.quantity_to_take) {
      const take = promo.quantity_to_take;
      const groups = Math.floor(units / take);
      if (groups > 0) {
        const itemsInBundles = take * groups;
        const normalUnits = units - itemsInBundles;
        const remaining = items.slice().sort((a, b) => b.unit_price_cents - a.unit_price_cents).slice(0, normalUnits);
        const remainingTotal = remaining.reduce((s, it) => s + it.unit_price_cents * it.qty, 0);
        total = promo.bundle_price_cents * groups + remainingTotal;
        discount = Math.max(0, subtotal - total);
      }
    } else if (promo.type === "bundle_mix" && promo.bundle_price_cents && promo.mix_config && promo.mix_config.length > 0) {
      // Calcular cuántos bundles se pueden formar (mínimo de grupos por cada regla)
      let minGroups = Infinity;
      for (const rule of promo.mix_config) {
        const matched = items
          .filter((it) => it.size_ml === rule.size_ml)
          .reduce((s, it) => s + it.qty, 0);
        minGroups = Math.min(minGroups, Math.floor(matched / rule.qty));
      }
      if (minGroups >= 1 && minGroups !== Infinity) {
        // Calcular costo normal de los items en el bundle
        let bundleNormalCost = 0;
        for (const rule of promo.mix_config) {
          const prices = items
            .filter((it) => it.size_ml === rule.size_ml)
            .flatMap((it) => Array(it.qty).fill(it.unit_price_cents))
            .sort((a, b) => a - b)
            .slice(0, rule.qty * minGroups);
          bundleNormalCost += prices.reduce((s, p) => s + p, 0);
        }
        total = promo.bundle_price_cents * minGroups;
        discount = Math.max(0, subtotal - total);
      }
    } else if (promo.type === "percent" && promo.value) {
      discount = Math.round(subtotal * (promo.value / 100));
      total = Math.max(0, subtotal - discount);
    } else if (promo.type === "fixed" && promo.value) {
      discount = Math.min(subtotal, promo.value);
      total = Math.max(0, subtotal - discount);
    } else if (promo.type === "second_unit" && promo.value != null) {
      // 2da unidad a X% — ordenamos por precio desc, cada par recibe descuento en el más barato
      const allPrices: number[] = [];
      for (const it of items) {
        for (let i = 0; i < it.qty; i++) allPrices.push(it.unit_price_cents);
      }
      allPrices.sort((a, b) => b - a);
      const pairs = Math.floor(units / 2);
      discount = allPrices.slice(0, pairs).reduce((s, p) => s + Math.round(p * ((promo.value ?? 0) / 100)), 0);
      total = Math.max(0, subtotal - discount);
    } else if (promo.type === "3x2" && promo.quantity_to_take && promo.quantity_to_take > 1) {
      const take = promo.quantity_to_take;
      const pay = Math.max(1, take - 1);
      const groups = Math.floor(units / take);
      if (groups > 0) {
        const allPrices: number[] = [];
        for (const it of items) {
          for (let i = 0; i < it.qty; i++) allPrices.push(it.unit_price_cents);
        }
        allPrices.sort((a, b) => a - b); // más baratos primero
        const freeAmount = allPrices.slice(0, take - pay).reduce((s, p) => s + p, 0) * groups;
        discount = freeAmount;
        total = Math.max(0, subtotal - discount);
      }
    } else if (promo.type === "2x1" && promo.quantity_to_take && promo.quantity_to_take > 1) {
      const take = promo.quantity_to_take;
      const pay = Math.max(1, take - 1);
      const groups = Math.floor(units / take);
      if (groups > 0) {
        const allPrices: number[] = [];
        for (const it of items) {
          for (let i = 0; i < it.qty; i++) allPrices.push(it.unit_price_cents);
        }
        allPrices.sort((a, b) => a - b);
        const freeAmount = allPrices.slice(0, take - pay).reduce((s, p) => s + p, 0) * groups;
        discount = freeAmount;
        total = Math.max(0, subtotal - discount);
      }
    }
  }

  return {
    total_cents: total,
    subtotal_cents: subtotal,
    discount_cents: discount,
    units,
    distinct: items.length,
    promo
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

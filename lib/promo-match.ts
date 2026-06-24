/**
 * Motor de auto-detección de promociones.
 * Evalúa todas las promos activas contra los items del carrito
 * y devuelve un ranking de las que aplican, ordenadas por mayor descuento.
 *
 * USADO POR:
 *   - components/CartProvider.tsx (cliente): auto-aplicar la mejor promo
 *   - app/api/checkout/bricks/init/route.ts (server): fallback de seguridad
 */
import { calculatePromo, type PromoItem, type PromoConfig } from "@/lib/promo-calc";

export type ActivePromotion = {
  slug: string;
  title: string;
  type: string;
  value: number;
  bundle_price_cents: number;
  required_size_ml: number | null;
  mix_sizes: boolean;
  mix_config: Array<{ size_ml: number; qty: number }> | null;
  quantity_to_take: number;
  quantity_to_pay: number;
  min_subtotal_cents: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type RankedPromo = {
  slug: string;
  title: string;
  type: string;
  discount_cents: number;
  total_cents: number;
  valid: boolean;
  reason?: string;
  summary: string;
  source: ActivePromotion;
};

/**
 * Convierte una ActivePromotion (de DB/API) a PromoConfig (para calculatePromo).
 * Maneja mix_config que puede venir como string JSON desde la DB.
 */
export function toPromoConfig(p: ActivePromotion): PromoConfig {
  let mixConfig: Array<{ size_ml: number; qty: number }> | null = null;
  if (p.mix_config) {
    if (Array.isArray(p.mix_config)) {
      mixConfig = p.mix_config;
    } else if (typeof p.mix_config === "string") {
      try { mixConfig = JSON.parse(p.mix_config); } catch { /* ignore */ }
    }
  }
  return {
    type: p.type,
    value: p.value,
    bundle_price_cents: p.bundle_price_cents,
    quantity_to_take: p.quantity_to_take,
    quantity_to_pay: p.quantity_to_pay,
    min_subtotal_cents: p.min_subtotal_cents ?? 0,
    mix_config: mixConfig,
    required_size_ml: p.required_size_ml ?? undefined,
    mix_sizes: p.mix_sizes,
  };
}

/**
 * Filtra promos vigentes (active + dentro de fechas).
 * Si `active` no está definido (ej: viene de API pública que ya filtró),
 * se asume true.
 */
export function isPromoActive(p: ActivePromotion, now: Date = new Date()): boolean {
  if (p.active === false) return false;
  if (p.starts_at && new Date(p.starts_at) > now) return false;
  if (p.ends_at && new Date(p.ends_at) < now) return false;
  return true;
}

/**
 * Evalúa todas las promos activas contra los items del carrito.
 * Devuelve un ranking ordenado por mayor descuento.
 * Solo incluye promos con valid=true Y discount_cents > 0
 * (o free_shipping que tiene discount=0 pero es valiosa).
 */
export function findBestPromo(
  items: PromoItem[],
  promotions: ActivePromotion[]
): RankedPromo[] {
  const now = new Date();
  const ranked: RankedPromo[] = [];

  for (const p of promotions) {
    if (!isPromoActive(p, now)) continue;

    const config = toPromoConfig(p);
    const result = calculatePromo(items, config);

    if (!result.valid) continue;

    // free_shipping es válido aunque discount_cents sea 0
    const isFreeShipping = p.type === "free_shipping";
    if (!isFreeShipping && result.discount_cents <= 0) continue;

    ranked.push({
      slug: p.slug,
      title: p.title,
      type: p.type,
      discount_cents: result.discount_cents,
      total_cents: result.total_cents,
      valid: result.valid,
      summary: result.summary,
      source: p,
    });
  }

  // Ordenar: mayor descuento primero.
  // free_shipping va primero si empatan en descuento (0) porque es muy valioso.
  ranked.sort((a, b) => {
    if (b.discount_cents !== a.discount_cents) return b.discount_cents - a.discount_cents;
    if (a.type === "free_shipping") return -1;
    if (b.type === "free_shipping") return 1;
    return 0;
  });

  return ranked;
}

/**
 * Devuelve la mejor promo para un carrito, o null si ninguna aplica.
 */
export function findBestSinglePromo(
  items: PromoItem[],
  promotions: ActivePromotion[]
): RankedPromo | null {
  const ranked = findBestPromo(items, promotions);
  return ranked[0] ?? null;
}

/**
 * Valida si una promo específica sigue siendo aplicable a los items actuales.
 * Usa la misma calculatePromo para consistencia.
 */
export function validatePromoForItems(
  items: PromoItem[],
  promotion: ActivePromotion
): { valid: boolean; discount_cents: number; reason?: string } {
  if (!isPromoActive(promotion)) {
    return { valid: false, discount_cents: 0, reason: "Promoción no vigente" };
  }
  const config = toPromoConfig(promotion);
  const result = calculatePromo(items, config);
  return {
    valid: result.valid,
    discount_cents: result.discount_cents,
    reason: result.reason,
  };
}

/**
 * Cálculo unificado de promociones.
 * Usado por:
 *   - lib/cart.ts (client-side, para mostrar total en carrito)
 *   - app/api/checkout/bricks/init (server-side, para cobro real)
 *
 * Una sola implementación = consistencia garantizada.
 */

export type PromoConfig = {
  type: string;
  value: number;
  bundle_price_cents: number;
  quantity_to_take: number;
  quantity_to_pay: number;
  min_subtotal_cents: number;
  mix_config: Array<{ size_ml: number; qty: number }> | null;
  /** Tamaño requerido para bundle_qty (ej. 10 para "3 × 10ml por $290") */
  required_size_ml?: number;
  /** Si true, bundle_qty permite mezclar tamaños (ignora required_size_ml) */
  mix_sizes?: boolean;
};

export type PromoItem = {
  size_ml: number;
  qty: number;
  unit_price_cents: number;
};

export type PromoResult = {
  /** La promo aplica (se cumplen los requisitos) */
  valid: boolean;
  /** Razón por la que no aplica (si valid=false) */
  reason?: string;
  /** Subtotal de todos los items */
  subtotal_cents: number;
  /** Descuento aplicado */
  discount_cents: number;
  /** Total a pagar */
  total_cents: number;
  /** Cuántos items están dentro del bundle/promo */
  items_in_promo: number;
  /** Cuántos items quedan fuera del bundle (precio normal) */
  items_outside: number;
  /** Resumen legible */
  summary: string;
};

/**
 * Expande los items del carrito a un array de precios unitarios.
 * Ej: [{qty: 2, unit_price: 100}, {qty: 1, unit_price: 200}] → [100, 100, 200]
 */
function expandPrices(items: PromoItem[]): number[] {
  const prices: number[] = [];
  for (const it of items) {
    for (let i = 0; i < it.qty; i++) {
      prices.push(it.unit_price_cents);
    }
  }
  return prices;
}

/**
 * Calcula el descuento y total de una promoción aplicada a un carrito.
 *
 * Lógica para cada tipo:
 *
 *  - bundle_qty: "3 por $290". Cada grupo de N items cuesta $X.
 *    Los items más baratos entran al bundle, el resto paga precio normal.
 *
 *  - bundle_mix: "2×30ml + 1×10ml por $60". El bundle se forma si hay
 *    suficientes items de cada tamaño. Items extra pagan precio normal.
 *
 *  - 3x2 / 2x1: Cada grupo de N items, los (N-M) más baratos son gratis.
 *
 *  - percent: X% de descuento sobre el subtotal (si cumple mínimo).
 *
 *  - fixed: $X de descuento (si cumple mínimo).
 *
 *  - second_unit: 2da unidad a X%. Items en posiciones pares reciben descuento.
 *
 *  - free_shipping: No afecta items, solo el envío.
 */
export function calculatePromo(
  items: PromoItem[],
  promo: PromoConfig
): PromoResult {
  const allPrices = expandPrices(items);
  const subtotal = allPrices.reduce((s, p) => s + p, 0);
  const totalUnits = allPrices.length;

  // Promos que no requieren selección de items (solo descuento)
  if (promo.type === "free_shipping") {
    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: 0,
      total_cents: subtotal,
      items_in_promo: 0,
      items_outside: totalUnits,
      summary: "Envío gratis",
    };
  }

  // Validar pedido mínimo
  if (promo.min_subtotal_cents && promo.min_subtotal_cents > 0 && subtotal < promo.min_subtotal_cents) {
    return {
      valid: false,
      subtotal_cents: subtotal,
      discount_cents: 0,
      total_cents: subtotal,
      items_in_promo: 0,
      items_outside: totalUnits,
      summary: `Pedido mínimo no alcanzado ($${(promo.min_subtotal_cents / 100).toFixed(0)})`,
    };
  }

  // --- percent ---
  if (promo.type === "percent") {
    const discount = Math.round(subtotal * (promo.value / 100));
    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: Math.max(0, subtotal - discount),
      items_in_promo: totalUnits,
      items_outside: 0,
      summary: `${promo.value}% de descuento`,
    };
  }

  // --- fixed ---
  if (promo.type === "fixed") {
    const discount = Math.min(subtotal, promo.value);
    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: Math.max(0, subtotal - discount),
      items_in_promo: totalUnits,
      items_outside: 0,
      summary: `$${(promo.value / 100).toFixed(0)} de descuento`,
    };
  }

  // --- second_unit ---
  if (promo.type === "second_unit") {
    // Ordenar precios descendentemente. Cada par (posición 0+1, 2+3, ...)
    // el segundo del par (más barato) recibe el descuento.
    const sorted = [...allPrices].sort((a, b) => b - a);
    const pairs = Math.floor(totalUnits / 2);
    let discount = 0;
    for (let i = 0; i < pairs; i++) {
      // El segundo item del par (índice i*2+1) es el más barato del par
      discount += Math.round(sorted[i * 2 + 1] * (promo.value / 100));
    }
    return {
      valid: pairs > 0,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: Math.max(0, subtotal - discount),
      items_in_promo: pairs * 2,
      items_outside: totalUnits - pairs * 2,
      summary: `2da unidad a ${promo.value}%`,
    };
  }

  // --- 3x2 / 2x1 ---
  if (promo.type === "3x2" || promo.type === "2x1") {
    const take = promo.quantity_to_take || (promo.type === "3x2" ? 3 : 2);
    const pay = promo.quantity_to_pay || (promo.type === "3x2" ? 2 : 1);
    const freePerGroup = take - pay;
    const groups = Math.floor(totalUnits / take);

    if (groups < 1) {
      return noPromoResult(subtotal, totalUnits, "Se requieren " + take + " fragancias");
    }

    // Ordenar todos los precios ascendentes (más baratos primero)
    const sorted = [...allPrices].sort((a, b) => a - b);
    // Los `freePerGroup * groups` más baratos son gratis
    const freeItems = sorted.slice(0, freePerGroup * groups);
    const discount = freeItems.reduce((s, p) => s + p, 0);

    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: Math.max(0, subtotal - discount),
      items_in_promo: take * groups,
      items_outside: totalUnits - take * groups,
      summary: `${promo.type.toUpperCase()}: lleva ${take} paga ${pay}`,
    };
  }

  // --- bundle_qty: "N por $X" ---
  if (promo.type === "bundle_qty") {
    const take = promo.quantity_to_take || 3;

    // Si required_size_ml está definido y mix_sizes no es true,
    // solo los items de ese tamaño cuentan para el bundle.
    // Los items de otros tamaños siempre pagan precio normal.
    const allowMix = promo.mix_sizes === true;
    const reqSize = promo.required_size_ml ?? null;

    let bundleItems: number[] = [];
    let outsideItems: number[] = [];

    if (reqSize !== null && !allowMix) {
      // Separar items por tamaño
      for (const it of items) {
        for (let i = 0; i < it.qty; i++) {
          if (it.size_ml === reqSize) {
            bundleItems.push(it.unit_price_cents);
          } else {
            outsideItems.push(it.unit_price_cents);
          }
        }
      }
    } else {
      // Comportamiento anterior: todos los items califican
      const all = [...allPrices].sort((a, b) => a - b);
      bundleItems = all;
    }

    const groups = Math.floor(bundleItems.length / take);

    if (groups < 1 || promo.bundle_price_cents <= 0) {
      return noPromoResult(subtotal, totalUnits, "Se requieren " + take + " fragancias" + (reqSize && !allowMix ? ` de ${reqSize}ml` : ""));
    }

    // Los `take * groups` items más baratos del bundle entran al grupo
    const sortedBundle = bundleItems.sort((a, b) => a - b);
    const inBundle = sortedBundle.slice(0, take * groups);
    const bundleNormalCost = inBundle.reduce((s, p) => s + p, 0);
    const bundleCost = promo.bundle_price_cents * groups;
    // SAFETY: el descuento nunca puede ser negativo (bundle más caro que precio normal)
    const discount = Math.max(0, bundleNormalCost - bundleCost);

    // Items del tamaño requerido que no entraron al bundle + items de otros tamaños
    const leftoverBundle = sortedBundle.slice(take * groups);
    const allOutside = [...leftoverBundle, ...outsideItems];
    const outsideCost = allOutside.reduce((s, p) => s + p, 0);

    // SAFETY: el total debe ser coherente — bundle + outside, nunca menos que 0
    const finalTotal = Math.max(0, bundleCost + outsideCost);

    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: finalTotal,
      items_in_promo: take * groups,
      items_outside: allOutside.length,
      summary: `Lleva ${take} por $${(promo.bundle_price_cents / 100).toFixed(0)}${groups > 1 ? ` (${groups} grupos)` : ""}`,
    };
  }

  // --- bundle_mix: "2×30ml + 1×10ml por $X" ---
  if (promo.type === "bundle_mix") {
    if (!promo.mix_config || promo.mix_config.length === 0 || promo.bundle_price_cents <= 0) {
      return noPromoResult(subtotal, totalUnits, "Configuración incompleta");
    }

    // Contar items por tamaño
    const sizePrices: Record<number, number[]> = {};
    for (const it of items) {
      if (!sizePrices[it.size_ml]) sizePrices[it.size_ml] = [];
      for (let i = 0; i < it.qty; i++) {
        sizePrices[it.size_ml].push(it.unit_price_cents);
      }
    }

    // Calcular cuántos bundles completos se pueden formar
    let minGroups = Infinity;
    for (const rule of promo.mix_config) {
      const available = (sizePrices[rule.size_ml]?.length ?? 0);
      const groupsForSize = Math.floor(available / rule.qty);
      minGroups = Math.min(minGroups, groupsForSize);
    }

    if (minGroups < 1 || minGroups === Infinity) {
      return noPromoResult(subtotal, totalUnits, "Bundle incompleto");
    }

    // Calcular costo normal de los items que entran al bundle (los más baratos por tamaño)
    let bundleNormalCost = 0;
    let bundleItemsCount = 0;
    const consumed: Record<number, number[]> = {}; // índices consumidos por tamaño

    for (const rule of promo.mix_config) {
      const prices = (sizePrices[rule.size_ml] ?? []).slice().sort((a, b) => a - b);
      const needed = rule.qty * minGroups;
      const taken = prices.slice(0, needed);
      bundleNormalCost += taken.reduce((s, p) => s + p, 0);
      bundleItemsCount += needed;
      consumed[rule.size_ml] = taken;
    }

    const bundleCost = promo.bundle_price_cents * minGroups;
    const discount = Math.max(0, bundleNormalCost - bundleCost);

    // Items fuera del bundle
    let outsideCost = 0;
    let outsideCount = 0;
    for (const sizeKey of Object.keys(sizePrices)) {
      const sizeMl = Number(sizeKey);
      const allForSize = sizePrices[sizeMl].slice().sort((a, b) => a - b);
      const consumedForSize = consumed[sizeMl]?.length ?? 0;
      const remaining = allForSize.slice(consumedForSize);
      outsideCost += remaining.reduce((s, p) => s + p, 0);
      outsideCount += remaining.length;
    }

    const desc = promo.mix_config.map((r) => `${r.qty}×${r.size_ml}ml`).join("+");
    return {
      valid: true,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: bundleCost + outsideCost,
      items_in_promo: bundleItemsCount,
      items_outside: outsideCount,
      summary: `Pack ${desc} por $${(promo.bundle_price_cents / 100).toFixed(0)}${minGroups > 1 ? ` (${minGroups} grupos)` : ""}`,
    };
  }

  // --- Tipo no reconocido ---
  return noPromoResult(subtotal, totalUnits, "Tipo de promo no soportado");
}

function noPromoResult(subtotal: number, totalUnits: number, summary: string): PromoResult {
  return {
    valid: false,
    subtotal_cents: subtotal,
    discount_cents: 0,
    total_cents: subtotal,
    items_in_promo: 0,
    items_outside: totalUnits,
    summary,
  };
}

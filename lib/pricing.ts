import { query } from "./db";

export type PricingDefault = {
  size_ml: number;
  price_cents: number;
  cost_cents: number;
  stock: number;
  sku_prefix: string;
  display_order: number;
};

export async function getPricingDefaults(): Promise<PricingDefault[]> {
  const result = await query<PricingDefault>(
    `SELECT size_ml, price_cents, cost_cents, stock, sku_prefix, display_order
     FROM pricing_defaults
     ORDER BY display_order, size_ml`
  );
  return result.rows;
}

export function generateSku(fragranceId: number, sizeMl: number, prefix = "PLT"): string {
  return `${prefix}-${String(fragranceId).padStart(3, "0")}-${sizeMl}`;
}

export function generateDisplayCode(fragranceId: number, prefix = "PLT"): string {
  return `${prefix}-${String(fragranceId).padStart(3, "0")}`;
}

export async function applyDefaultsToAllFragrances(defaults: PricingDefault[]): Promise<number> {
  let updated = 0;
  for (const d of defaults) {
    const r = await query(
      `UPDATE presentation p
       SET price_cents = $1,
           cost_cents = $2,
           stock = $3,
           sku = $4 || '-' || LPAD(p.fragrance_id::text, 3, '0') || '-' || p.size_ml
       FROM fragrance f
       WHERE p.fragrance_id = f.id
         AND f.active = TRUE
         AND p.size_ml = $5`,
      [d.price_cents, d.cost_cents, d.stock, d.sku_prefix, d.size_ml]
    );
    updated += r.rowCount ?? 0;
  }
  return updated;
}

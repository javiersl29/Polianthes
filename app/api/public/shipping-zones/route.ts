import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/shipping-zones
 * Devuelve zonas de envío (CP) y sitios de entrega física (pickup)
 * separados, más la configuración global de envío.
 */
export async function GET() {
  const r = await query(
    `SELECT id, name, kind, postal_code_prefix, cost_cents, free_from_cents,
            estimated_days, display_order,
            pickup_address, pickup_city, pickup_state, pickup_postal_code,
            pickup_schedule, pickup_lat, pickup_lng, phone, email
     FROM shipping_zone
     WHERE active = TRUE
     ORDER BY kind, display_order, name`
  );
  const rows = r.rows as Array<{ kind: "shipping" | "pickup" }>;

  const cfg = await query(
    `SELECT default_cost_cents, default_free_from_cents, default_estimated_days,
            override_enabled, override_cost_cents, override_free_from_cents,
            override_estimated_days, override_label, active
     FROM shipping_config WHERE id = 1`
  );

  return NextResponse.json({
    zones: rows.filter((x) => x.kind === "shipping"),
    pickups: rows.filter((x) => x.kind === "pickup"),
    all: rows,
    config: cfg.rows[0] ?? null
  });
}

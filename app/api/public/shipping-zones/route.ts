import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/shipping-zones
 * Devuelve zonas de envío (CP) y sitios de entrega física (pickup)
 * separados. El checkout los ofrece como opciones distintas.
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
  return NextResponse.json({
    zones: rows.filter((x) => x.kind === "shipping"),
    pickups: rows.filter((x) => x.kind === "pickup"),
    all: rows
  });
}

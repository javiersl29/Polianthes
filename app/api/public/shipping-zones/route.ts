import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/shipping-zones
 * Lista las zonas de envío activas para que el checkout público
 * pueda calcular el costo de envío según el código postal del cliente.
 */
export async function GET() {
  const r = await query<{
    id: number;
    name: string;
    postal_code_prefix: string;
    cost_cents: number;
    free_from_cents: number | null;
    estimated_days: string | null;
    display_order: number;
  }>(
    `SELECT id, name, postal_code_prefix, cost_cents, free_from_cents, estimated_days, display_order
     FROM shipping_zone WHERE active = TRUE ORDER BY display_order, name`
  );
  return NextResponse.json({ zones: r.rows });
}

/**
 * GET /api/public/shipping-quote?postal_code=01000
 * Devuelve la zona que aplica al CP dado y el costo calculado para un
 * subtotal opcional.
 */

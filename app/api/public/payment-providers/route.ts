import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/payment-providers
 * Lista los proveedores de pago activos con sus publishable keys (sólo
 * las que son seguras para el frontend). El checkout público usa esto
 * para decidir qué botones mostrar.
 */
export async function GET() {
  const r = await query<{
    provider: "mercadopago" | "stripe";
    mode: "test" | "live";
    mp_public_key: string | null;
    stripe_publishable_key: string | null;
    installments_min: number;
    installments_max: number;
  }>(
    `SELECT provider, mode, mp_public_key, stripe_publishable_key, installments_min, installments_max
     FROM payment_provider_config WHERE active = TRUE
     ORDER BY provider`
  );
  return NextResponse.json({ providers: r.rows });
}

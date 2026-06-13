import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/coupon?code=VERANO&subtotal_cents=10000
 * Valida un cupón contra el subtotal dado y devuelve el descuento.
 */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase().trim();
  const subtotal = Number(req.nextUrl.searchParams.get("subtotal_cents") ?? "0");
  if (!code) {
    return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  }
  const r = await query<{
    type: "percent" | "fixed";
    value: number;
    min_subtotal_cents: number | null;
    expires_at: string | null;
    usage_limit: number | null;
    usage_count: number;
    active: boolean;
  }>(
    `SELECT type, value, min_subtotal_cents, expires_at, usage_limit, usage_count, active
     FROM coupon WHERE code = $1`,
    [code]
  );
  const c = r.rows[0];
  if (!c) return NextResponse.json({ ok: false, valid: false, message: "Cupón no encontrado" });
  if (!c.active) return NextResponse.json({ ok: false, valid: false, message: "Cupón inactivo" });
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, valid: false, message: "Cupón expirado" });
  }
  if (c.usage_limit && c.usage_count >= c.usage_limit) {
    return NextResponse.json({ ok: false, valid: false, message: "Cupón agotado" });
  }
  if (c.min_subtotal_cents && subtotal < c.min_subtotal_cents) {
    return NextResponse.json({
      ok: false, valid: false,
      message: `Mínimo ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c.min_subtotal_cents / 100)}`
    });
  }
  const discount = c.type === "percent"
    ? Math.round(subtotal * (c.value / 100))
    : Math.min(subtotal, c.value);
  return NextResponse.json({
    ok: true,
    valid: true,
    code,
    discount_cents: discount,
    type: c.type,
    value: c.value
  });
}

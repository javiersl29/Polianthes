import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/coupons
 * Devuelve todos los cupones (activos e inactivos).
 */
export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await query(
    `SELECT id, code, type, value, min_subtotal_cents, expires_at,
            usage_limit, usage_count, active, description, created_at
     FROM coupon
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ coupons: r.rows });
}

/**
 * POST /api/admin/coupons
 * Crea o actualiza un cupón.
 * Body: { id?, code, type, value, min_subtotal_cents?, expires_at?, usage_limit?, description?, active? }
 * - type=percent: value es % (entero 0-100, se guarda *100 en centavos internamente? NO — se guarda directo como integer %)
 *   En realidad: la columna "value" guarda el valor en la misma unidad según tipo:
 *     - percent → 100 = 1% (ej. value=1500 = 15%)
 *     - fixed → centavos (ej. value=5000 = $50)
 *   Esto coincide con el checkout: discount = percent ? subtotal * (value/100) : min(subtotal, value)
 */
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const code = String(body.code ?? "").toUpperCase().trim();
  const type = body.type === "fixed" ? "fixed" : "percent";

  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  if (!/^[A-Z0-9_\-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: "Código inválido. Usa solo letras, números, guiones (3-32 caracteres)" }, { status: 400 });
  }

  // value: percent → 100=1% (pasamos decimal *100), fixed → centavos
  let value: number;
  if (type === "percent") {
    value = Math.round(Number(body.value) * 100); // ej. 15% → 1500
    if (value < 100 || value > 10000) {
      return NextResponse.json({ error: "El porcentaje debe estar entre 1% y 100%" }, { status: 400 });
    }
  } else {
    value = Math.round(Number(body.value));
    if (value < 100) {
      return NextResponse.json({ error: "El monto mínimo es $1" }, { status: 400 });
    }
  }

  const minSubtotal = body.min_subtotal_cents != null ? Math.round(Number(body.min_subtotal_cents)) : null;
  const expiresAt = body.expires_at ?? null;
  const usageLimit = body.usage_limit != null ? Math.round(Number(body.usage_limit)) : null;
  const description = body.description ?? null;
  const active = body.active !== false;

  if (body.id) {
    // Actualizar
    const check = await query(`SELECT id FROM coupon WHERE code = $1 AND id != $2`, [code, Number(body.id)]);
    if (check.rows.length > 0) {
      return NextResponse.json({ error: "Ya existe otro cupón con ese código" }, { status: 409 });
    }
    await query(
      `UPDATE coupon
       SET code = $1, type = $2, value = $3, min_subtotal_cents = $4,
           expires_at = $5, usage_limit = $6, description = $7, active = $8
       WHERE id = $9`,
      [code, type, value, minSubtotal, expiresAt, usageLimit, description, active, Number(body.id)]
    );
    return NextResponse.json({ ok: true });
  }

  // Crear
  const existing = await query(`SELECT id FROM coupon WHERE code = $1`, [code]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Ya existe un cupón con ese código" }, { status: 409 });
  }

  await query(
    `INSERT INTO coupon (code, type, value, min_subtotal_cents, expires_at, usage_limit, description, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [code, type, value, minSubtotal, expiresAt, usageLimit, description, active]
  );
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/coupons?id=...
 * Elimina un cupón.
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  await query(`DELETE FROM coupon WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
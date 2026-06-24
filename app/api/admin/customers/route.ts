import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/customers?q=search
 * Lista los clientes registrados con búsqueda opcional por email/nombre.
 *
 * PRIVACIDAD: NO devolvemos password_hash, verification_token ni tokens de reset.
 * Solo datos seguros para administración: email, nombre, stats de compra,
 * fecha de registro, estado de verificación.
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const r = await query(
    `SELECT id, email, name, picture_url, phone,
            email_verified, affiliated,
            total_orders, total_spent_cents,
            last_login_at, created_at
     FROM customer
     WHERE ($1 = '' OR email ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%')
     ORDER BY created_at DESC
     LIMIT 200`,
    [q]
  );
  return NextResponse.json({ customers: r.rows });
}

/**
 * DELETE /api/admin/customers?id=...
 * Elimina un cliente y todos sus datos personales.
 * Los pedidos pasan a tener customer_id=NULL (ON DELETE SET NULL).
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Verificar que existe
  const exists = await query<{ id: number; email: string }>(`SELECT id, email FROM customer WHERE id = $1`, [id]);
  if (exists.rows.length === 0) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Eliminar: el ON DELETE SET NULL en orders.customer_id preserva las órdenes
  // sin datos personales vinculantes.
  await query(`DELETE FROM customer WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true, deleted_email: exists.rows[0].email });
}
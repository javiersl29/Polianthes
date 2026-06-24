import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentCustomer,
  clearCustomerCookie,
  updateCustomerProfile,
  markCustomerAffiliated
} from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/customer/me
 * Devuelve el cliente logueado o null.
 */
export async function GET() {
  const customer = await getCurrentCustomer();
  return NextResponse.json({ customer: customer ?? null });
}

/**
 * POST /api/customer/me
 * Body: { action: "logout" } — limpia la cookie del cliente
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "logout") {
    clearCustomerCookie();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete_account") {
    return deleteAccount();
  }
  return NextResponse.json({ error: "acción no soportada" }, { status: 400 });
}

/**
 * DELETE /api/customer/me
 * Elimina la cuenta del cliente autenticado.
 * Mismo flujo que POST con action=delete_account (alternativa REST).
 */
export async function DELETE() {
  return deleteAccount();
}

async function deleteAccount() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "no has iniciado sesión" }, { status: 401 });
  }
  // ON DELETE SET NULL en orders.customer_id preserva pedidos sin datos personales.
  await query(`DELETE FROM customer WHERE id = $1`, [customer.id]);
  clearCustomerCookie();
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/customer/me
 * Body: { name?, phone?, birth_date?, default_address_*?, affiliate: true }
 * Actualiza el perfil del cliente logueado. Si affiliate=true, marca como afiliado.
 */
export async function PATCH(req: NextRequest) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "no has iniciado sesión" }, { status: 401 });
  }
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "name", "phone", "birth_date",
    "default_address_line", "default_address_line2",
    "default_city", "default_state", "default_postal_code", "default_country"
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  if (Object.keys(allowed).length > 0) {
    await updateCustomerProfile(customer.id, allowed);
  }
  if (body.affiliate === true) {
    await markCustomerAffiliated(customer.id);
  }
  const updated = await query(
    `SELECT id, email, name, picture_url, phone, birth_date, affiliated,
            default_address_line, default_address_line2, default_city, default_state,
            default_postal_code, default_country
     FROM customer WHERE id = $1`,
    [customer.id]
  );
  return NextResponse.json({ customer: updated.rows[0] });
}

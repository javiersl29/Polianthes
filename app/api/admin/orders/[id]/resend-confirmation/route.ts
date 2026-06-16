import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { sendOrderConfirmationEmail } from "@/lib/notifications";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/resend-confirmation
 * Reenvía el email de confirmación de pago al cliente de este pedido.
 * Útil cuando el cliente perdió el email original o lo necesita de nuevo.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  const r = await query<{ id: number; status: string; public_id: string; customer_email: string }>(
    `SELECT id, status, public_id, customer_email FROM "order" WHERE id = $1`,
    [orderId]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ ok: false, message: "Pedido no encontrado" }, { status: 404 });
  }

  await sendOrderConfirmationEmail(orderId);
  return NextResponse.json({
    ok: true,
    message: `Confirmación reenviada a ${r.rows[0].customer_email}`
  });
}

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listOrderEmails, OrderEmailLog } from "@/lib/notifications";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders/[id]/emails
 * Devuelve el historial de emails enviados al cliente de este pedido.
 * Incluye emails automáticos (confirmación, envío, cambios de estado)
 * y emails manuales que el admin haya enviado desde el panel.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  const orderRes = await query<{ id: number; public_id: string; customer_email: string; customer_name: string }>(
    `SELECT id, public_id, customer_email, customer_name FROM "order" WHERE id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    return NextResponse.json({ error: "pedido no encontrado" }, { status: 404 });
  }
  const order = orderRes.rows[0];
  const emails: OrderEmailLog[] = await listOrderEmails(orderId);
  return NextResponse.json({ order, emails });
}

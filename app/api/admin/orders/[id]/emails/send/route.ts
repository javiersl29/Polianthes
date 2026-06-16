import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { sendManualEmailToCustomer } from "@/lib/notifications";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/emails/send
 * El admin envía un email personalizado al cliente del pedido.
 * Body: { subject: string, html: string, text?: string }
 *
 * El email se registra en order_email y se queda en el historial
 * para referencia futura.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  const body = await req.json();
  const subject = String(body.subject ?? "").trim();
  const html = String(body.html ?? "").trim();
  const text = String(body.text ?? "").trim() || stripHtml(html);

  if (!subject) return NextResponse.json({ ok: false, message: "El asunto es obligatorio" }, { status: 400 });
  if (!html) return NextResponse.json({ ok: false, message: "El cuerpo es obligatorio" }, { status: 400 });
  if (subject.length > 200) return NextResponse.json({ ok: false, message: "Asunto demasiado largo (máx 200)" }, { status: 400 });

  const orderCheck = await query<{ customer_email: string }>(
    `SELECT customer_email FROM "order" WHERE id = $1`,
    [orderId]
  );
  if (orderCheck.rows.length === 0) {
    return NextResponse.json({ ok: false, message: "Pedido no encontrado" }, { status: 404 });
  }

  const result = await sendManualEmailToCustomer({
    orderId,
    subject,
    html,
    text,
    sentBy: "admin",
    kind: "manual"
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/bricks/process
 * Recibe el formData que envía el Payment Brick en onSubmit.
 * Crea el pago en Mercado Pago y actualiza la orden en DB.
 *
 * formData incluye (según método elegido):
 *  - token: token de tarjeta (si es crédito/débito)
 *  - payment_method_id: visa, master, amex, oxxo, paycash, etc.
 *  - installments: número de cuotas
 *  - issuer_id: banco emisor
 *  - payer: { email, identification, first_name, last_name }
 *  - transaction_amount: monto
 *
 * Body adicional nuestro: { order_id, public_id }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { formData, order_id, public_id } = body;

  if (!order_id || !public_id) {
    return NextResponse.json({ error: "Falta order_id/public_id" }, { status: 400 });
  }
  if (!formData) {
    return NextResponse.json({ error: "Falta formData" }, { status: 400 });
  }

  const cfg = await getPaymentProvider("mercadopago");
  if (!cfg || !cfg.active || !cfg.mp_access_token) {
    return NextResponse.json({ error: "MP no configurado" }, { status: 503 });
  }

  // Cargar la orden desde DB (no confiar en transaction_amount del cliente)
  const pool = getPool();
  const orderRow = (await pool.query<{
    id: number; total_cents: number; customer_email: string; customer_name: string;
  }>(
    `SELECT id, total_cents, customer_email, customer_name FROM "order" WHERE id = $1 AND public_id = $2`,
    [Number(order_id), String(public_id)]
  )).rows[0];
  if (!orderRow) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  // Construir el body para /v1/payments
  // Combinar el formData del brick con datos de nuestra orden
  const paymentBody: Record<string, unknown> = {
    transaction_amount: orderRow.total_cents / 100,
    description: `Pedido Polianthes ${public_id}`,
    external_reference: public_id,
    metadata: { order_id: orderRow.id, public_id },
    ...formData,
    // Si formData trae payer, fusionar; si no, usar customer de la orden
    payer: formData.payer ?? {
      email: orderRow.customer_email,
      first_name: orderRow.customer_name
    }
  };

  let paymentRes: Response;
  try {
    paymentRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.mp_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pay-${public_id}-${Date.now()}`
      },
      body: JSON.stringify(paymentBody),
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo conectar con MP", detail: e instanceof Error ? e.message : "" },
      { status: 502 }
    );
  }

  if (!paymentRes.ok) {
    const errText = await paymentRes.text();
    return NextResponse.json(
      { error: "MP rechazó el pago", status: paymentRes.status, detail: errText },
      { status: 502 }
    );
  }

  const payment = await paymentRes.json();

  // Mapear estado de MP → nuestro status
  const status = payment.status; // approved | pending | rejected | in_process | cancelled
  const mapped = status === "approved" ? "approved"
    : (status === "pending" || status === "in_process") ? "pending"
    : status === "rejected" ? "rejected"
    : status === "cancelled" ? "cancelled"
    : "pending";

  // Actualizar orden
  await pool.query(
    `UPDATE "order"
     SET status = $1,
         mp_status = $2,
         mp_payment_id = $3,
         paid_at = CASE WHEN $1 = 'approved' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
         updated_at = NOW(),
         status_history = status_history || jsonb_build_array(
           jsonb_build_object('status', $1, 'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                              'note', 'Bricks: ' || $4)
         )
     WHERE id = $5`,
    [mapped, status, String(payment.id ?? ""), status, orderRow.id]
  );

  if (mapped === "approved") {
    await pool.query(
      `UPDATE coupon SET usage_count = usage_count + 1
       WHERE code = (SELECT coupon_code FROM "order" WHERE id = $1)
         AND coupon_code IS NOT NULL`,
      [orderRow.id]
    );
  }

  // Devolver info que el brick necesita para mostrar el resultado
  return NextResponse.json({
    status: payment.status,
    status_detail: payment.status_detail,
    payment_id: payment.id,
    order_id: orderRow.id,
    public_id,
    // Status Screen Brick necesita:
    payment_method_id: payment.payment_method_id,
    transaction_amount: payment.transaction_amount
  });
}

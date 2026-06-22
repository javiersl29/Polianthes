import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/bricks/process
 * Recibe el formData que envía el Payment Brick en onSubmit.
 * Crea el pago en Mercado Pago y actualiza la orden en DB.
 *
 * formData puede traer (según método elegido por el cliente):
 *  - Tarjeta:  { token, payment_method_id, payment_type_id, issuer_id,
 *                installments, payer: {email, identification, first_name, last_name} }
 *  - Efectivo: { payment_method_id: "oxxo"/"paycash", payment_type_id: "ticket",
 *                payer: {email} }
 *  - ATM:      { payment_method_id: "..."
 *
 * Importante: el brick NO envía transaction_amount. Lo agregamos nosotros
 * desde la orden en DB (para evitar manipulación client-side).
 */
export async function POST(req: NextRequest) {
  console.log("[bricks/process] start");
  try {
    const body = await req.json();
    const { formData, selectedPaymentMethod, order_id, public_id, wallet } = body;

    console.log("[bricks/process] body keys:", Object.keys(body));
    console.log("[bricks/process] wallet:", !!wallet, "| spm:", JSON.stringify(selectedPaymentMethod)?.slice(0, 100));

    if (!order_id || !public_id) {
      return NextResponse.json({ error: "Falta order_id/public_id" }, { status: 400 });
    }

    const cfg = await getPaymentProvider("mercadopago");
    if (!cfg || !cfg.active || !cfg.mp_access_token) {
      return NextResponse.json({ error: "MP no configurado" }, { status: 503 });
    }

    const pool = getPool();

    // Wallet MP: el brick maneja el pago internamente.
    // Solo marcamos la orden como pendiente y dejamos que MP la procese.
    // El webhook actualizará el estado cuando MP confirme.
    if (wallet) {
      await pool.query(
        `UPDATE "order" SET status = 'pending', mp_status = 'pending_wallet', updated_at = NOW() WHERE id = $1 AND public_id = $2`,
        [Number(order_id), String(public_id)]
      );
      console.log("[bricks/process] wallet order marked pending:", order_id);
      return NextResponse.json({ ok: true, status: "pending", public_id });
    }

    const form = (formData && typeof formData === "object") ? formData : {};
    const spmRaw = typeof selectedPaymentMethod === "string" ? selectedPaymentMethod : "";
    const spm = (selectedPaymentMethod && typeof selectedPaymentMethod === "object") ? selectedPaymentMethod as Record<string, unknown> : {};

    let paymentMethodId = form.payment_method_id ?? spm.id ?? spm.paymentMethodId ?? null;
    if (!paymentMethodId && spmRaw === "wallet_purchase") {
      paymentMethodId = "account_money";
    }
    let paymentTypeId = form.payment_type_id ?? spm.type ?? spm.paymentTypeId ?? null;
    if (!paymentTypeId && spmRaw === "wallet_purchase") {
      paymentTypeId = "account_money";
    }
    const orderRow = (await pool.query<{
      id: number; total_cents: number; customer_email: string; customer_name: string;
    }>(
      `SELECT id, total_cents, customer_email, customer_name FROM "order" WHERE id = $1 AND public_id = $2`,
      [Number(order_id), String(public_id)]
    )).rows[0];
    if (!orderRow) {
      console.log("[bricks/process] ORDER not found:", order_id, public_id);
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    // Construir el body para /v1/payments.
    // formData tiene los datos del brick (token, installments, etc.).
    // Si formData está vacío (ej. saldo MP), usamos selectedPaymentMethod.
    const transactionAmount = orderRow.total_cents / 100;
    const paymentBody: Record<string, unknown> = {
      transaction_amount: transactionAmount,
      description: `Pedido Polianthes ${public_id}`,
      external_reference: public_id,
      token: form.token,
      payment_method_id: paymentMethodId,
      payment_type_id: paymentTypeId,
      installments: form.installments ?? 1,
      issuer_id: form.issuer_id,
      // Payer: si el brick trae payer, lo usamos; si no, usamos el customer de la orden
      payer: form.payer ?? spm.payer ?? {
        email: orderRow.customer_email,
        first_name: orderRow.customer_name
      },
      metadata: { order_id: orderRow.id, public_id },
      statement_descriptor: "POLIANTHES"
    };

    // Limpiar keys undefined/null (MP rechaza si enviamos issuer_id: undefined)
    for (const k of Object.keys(paymentBody)) {
      if (paymentBody[k] === undefined || paymentBody[k] === null) {
        delete paymentBody[k];
      }
    }

    console.log("[bricks/process] paymentBody:", JSON.stringify({
      ...paymentBody,
      token: paymentBody.token ? "(hidden)" : null
    }));

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
      console.error("[bricks/process] FETCH error:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "No se pudo conectar con Mercado Pago", detail: e instanceof Error ? e.message : "" },
        { status: 502 }
      );
    }

    const paymentText = await paymentRes.text();
    if (!paymentRes.ok) {
      console.error("[bricks/process] MP rejected:", paymentRes.status, paymentText.slice(0, 500));
      let parsed: { message?: string; cause?: Array<{ description?: string }> } = {};
      try { parsed = JSON.parse(paymentText); } catch { /* no-op */ }
      const userMsg = parsed.message
        ?? parsed.cause?.[0]?.description
        ?? "Mercado Pago rechazó el pago";
      return NextResponse.json(
        { error: userMsg, mp_status: paymentRes.status, detail: paymentText.slice(0, 300) },
        { status: 502 }
      );
    }

    const payment = JSON.parse(paymentText);
    console.log("[bricks/process] MP OK:", payment.id, payment.status);

    // Mapear estado de MP → nuestro status
    const status = payment.status;
    const mapped = status === "approved" ? "approved"
      : (status === "pending" || status === "in_process") ? "pending"
      : status === "rejected" ? "rejected"
      : status === "cancelled" ? "cancelled"
      : "pending";

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
      try {
        await pool.query(
          `UPDATE coupon SET usage_count = usage_count + 1
           WHERE code = (SELECT coupon_code FROM "order" WHERE id = $1)
             AND coupon_code IS NOT NULL`,
          [orderRow.id]
        );
      } catch (e) {
        console.error("[bricks/process] coupon update (non-critical):", e instanceof Error ? e.message : e);
      }
    }

    // Enviar notificaciones (no bloquear si falla)
    try {
      const { sendOrderConfirmationEmail, sendAdminNewOrderNotification } = await import("@/lib/notifications");
      await Promise.all([
        sendOrderConfirmationEmail(orderRow.id),
        sendAdminNewOrderNotification(orderRow.id)
      ]);
    } catch (e) {
      console.error("[bricks/process] notifications (non-critical):", e instanceof Error ? e.message : e);
    }

    // Si el cliente tiene cuenta, marcar como afiliado y actualizar stats
    try {
      const { getCurrentCustomer, markCustomerAffiliated, incrementCustomerStats } = await import("@/lib/customer-auth");
      const customer = await getCurrentCustomer();
      if (customer) {
        await markCustomerAffiliated(customer.id);
        await incrementCustomerStats(customer.id, orderRow.total_cents);
      }
    } catch (e) {
      console.error("[bricks/process] customer stats (non-critical):", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      status: payment.status,
      status_detail: payment.status_detail,
      payment_id: payment.id,
      order_id: orderRow.id,
      public_id,
      payment_method_id: payment.payment_method_id,
      transaction_amount: payment.transaction_amount
    });
  } catch (e) {
    console.error("[bricks/process] UNHANDLED error:", e instanceof Error ? e.stack : e);
    return NextResponse.json(
      { error: "Error interno del servidor", detail: e instanceof Error ? e.message : "" },
      { status: 500 }
    );
  }
}

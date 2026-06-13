import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Webhook de Stripe.
 * Verifica la firma con stripe_webhook_secret y procesa los eventos:
 *  - checkout.session.completed → marca orden como approved
 *  - payment_intent.payment_failed → rejected
 *  - charge.refunded → refunded
 *
 * Doc: https://stripe.com/docs/webhooks
 */
export async function POST(req: NextRequest) {
  const cfg = await getPaymentProvider("stripe");
  if (!cfg || !cfg.stripe_webhook_secret) {
    return NextResponse.json({ ok: false, error: "Stripe webhook secret no configurado" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  if (sig) {
    // Verificar firma manualmente con Stripe-Signature (formato t=…,v1=…)
    const parts = sig.split(",").map((p) => p.split("="));
    const t = parts.find((p) => p[0] === "t")?.[1];
    const v1 = parts.find((p) => p[0] === "v1")?.[1];
    if (!t || !v1) {
      return NextResponse.json({ error: "firma inválida" }, { status: 400 });
    }
    const payload = `${t}.${raw}`;
    const expected = createHmac("sha256", cfg.stripe_webhook_secret).update(payload).digest("hex");
    if (expected !== v1) {
      return NextResponse.json({ error: "firma no coincide" }, { status: 400 });
    }
    // Anti-replay (5 min)
    const ageSec = Math.abs(Date.now() / 1000 - Number(t));
    if (ageSec > 300) {
      return NextResponse.json({ error: "event expirado" }, { status: 400 });
    }
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const pool = getPool();
  const obj = event.data?.object ?? {};
  const metadata = (obj.metadata ?? {}) as Record<string, string>;
  const orderId = metadata.order_id ? Number(metadata.order_id) : null;
  const publicId = metadata.public_id ?? null;

  if (!orderId && !publicId) {
    // Sin forma de identificar la orden; ignoramos
    return NextResponse.json({ ok: true, ignored: "sin metadata" });
  }

  const matchClause = orderId ? `id = $1` : `public_id = $1`;
  const matchVal = orderId ?? publicId;

  const eventType = event.type;
  let newStatus: "approved" | "rejected" | "refunded" | null = null;
  if (eventType === "checkout.session.completed" || eventType === "payment_intent.succeeded") {
    newStatus = "approved";
  } else if (eventType === "payment_intent.payment_failed" || eventType === "checkout.session.async_payment_failed") {
    newStatus = "rejected";
  } else if (eventType === "charge.refunded") {
    newStatus = "refunded";
  }

  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  await pool.query(
    `UPDATE "order"
     SET status = $2,
         paid_at = CASE WHEN $2 = 'approved' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
         updated_at = NOW(),
         status_history = status_history || jsonb_build_array(
           jsonb_build_object('status', $2, 'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                              'note', 'Stripe webhook: ' || $3)
         )
     WHERE ${matchClause}`,
    [matchVal, newStatus, eventType]
  );

  if (newStatus === "approved") {
    await pool.query(
      `UPDATE coupon SET usage_count = usage_count + 1
       WHERE id = (SELECT promotion_id FROM "order" WHERE ${matchClause})
         AND id IS NOT NULL`,
      [matchVal]
    );
    await pool.query(
      `UPDATE coupon SET usage_count = usage_count + 1
       WHERE code = (SELECT coupon_code FROM "order" WHERE ${matchClause})
         AND code IS NOT NULL`,
      [matchVal]
    );
  }

  return NextResponse.json({ ok: true, mapped: newStatus });
}

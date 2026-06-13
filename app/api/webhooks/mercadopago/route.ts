import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/**
 * Webhook de MercadoPago.
 * Recibe notificaciones IPN y webhook (HTTP) para confirmar pagos.
 * Doc: https://www.mercadopago.com.mx/developers/es/docs/checkout-api/integration-test/webhooks
 *
 * Tipos relevantes:
 *  - payment: actualización de estado de pago
 *  - merchant_order: agrupa varios pagos
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const topic = body?.type ?? body?.topic ?? req.nextUrl.searchParams.get("type") ?? req.nextUrl.searchParams.get("topic");
  const dataId = body?.data?.id ?? body?.resource ?? req.nextUrl.searchParams.get("data.id") ?? req.nextUrl.searchParams.get("id");

  // MP hace un GET inicial para verificar la URL — respondemos 200 sin hacer nada
  if (!topic && !dataId) {
    return NextResponse.json({ ok: true, echo: "webhook_received" });
  }

  const cfg = await getPaymentProvider("mercadopago");
  if (!cfg || !cfg.mp_access_token) {
    return NextResponse.json({ ok: false, error: "MP no configurado" }, { status: 500 });
  }

  // Sólo nos interesan los payments para confirmar
  if (topic !== "payment" && topic !== "MercadoPago.Payment") {
    return NextResponse.json({ ok: true, ignored: topic });
  }

  const paymentId = String(dataId ?? body?.data?.id ?? "");

  // Consultar el estado del pago a la API de MP
  let mpPayment: { status?: string; external_reference?: string; id?: number; order?: { id?: number } };
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${cfg.mp_access_token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `MP status ${r.status}` }, { status: 200 });
    }
    mpPayment = await r.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "" }, { status: 200 });
  }

  const status = mpPayment.status; // approved | pending | rejected | cancelled | refunded | in_mediation
  const externalRef = mpPayment.external_reference; // nuestro public_id
  if (!externalRef) {
    return NextResponse.json({ ok: true, ignored: "sin external_reference" });
  }

  const pool = getPool();

  // Mapear estado de MP → nuestro status
  const mapped = status === "approved" ? "approved"
    : status === "pending" || status === "in_mediation" ? "pending"
    : status === "rejected" || status === "cancelled" ? "rejected"
    : status === "refunded" ? "refunded"
    : null;

  if (!mapped) {
    return NextResponse.json({ ok: true, ignored: `status ${status}` });
  }

  await pool.query(
    `UPDATE "order"
     SET status = $1,
         mp_status = $2,
         mp_payment_id = $3,
         paid_at = CASE WHEN $1 = 'approved' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
         updated_at = NOW(),
         status_history = status_history || jsonb_build_array(
           jsonb_build_object('status', $1, 'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                              'note', 'MercadoPago webhook: ' || $4)
         )
     WHERE public_id = $5`,
    [mapped, status, paymentId, status, externalRef]
  );

  // Incrementar usage_count de cupón si se aprobó y la orden usó coupon
  if (mapped === "approved") {
    await pool.query(
      `UPDATE coupon SET usage_count = usage_count + 1
       WHERE code = (SELECT coupon_code FROM "order" WHERE public_id = $1)
         AND coupon_code IS NOT NULL`,
      [externalRef]
    );
  }

  return NextResponse.json({ ok: true, mapped, public_id: externalRef });
}

export async function GET(req: NextRequest) {
  // MP puede validar la URL con un GET
  return NextResponse.json({ ok: true });
}

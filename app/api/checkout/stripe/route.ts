import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

type CartItem = {
  slug: string;
  size_ml: number;
  qty: number;
};

type Body = {
  items: CartItem[];
  customer: { email: string; name: string; phone?: string };
  shipping: {
    zone_id: number;
    kind?: "shipping" | "pickup";
    address_line: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  };
  coupon_code?: string;
};

/**
 * POST /api/checkout/stripe
 * Crea una orden en DB y genera una Stripe Checkout Session.
 * Devuelve { url, order_id, public_id }.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  const cfg = await getPaymentProvider("stripe");
  if (!cfg || !cfg.active || !cfg.stripe_secret_key) {
    return NextResponse.json({ error: "Stripe no está configurado" }, { status: 503 });
  }

  const pool = getPool();

  // 1) Precios reales de DB
  const itemsRes = await pool.query<{
    fragrance_id: number; slug: string; brand: string; name: string; full_name: string;
    size_ml: number; price_cents: number;
  }>(
    `SELECT f.id AS fragrance_id, f.slug, f.brand, f.name, f.full_name,
            p.size_ml, p.price_cents
     FROM presentation p
     JOIN fragrance f ON f.id = p.fragrance_id
     WHERE f.active = TRUE AND p.size_ml = ANY($1::int[])
       AND f.slug = ANY($2::text[])`,
    [body.items.map((i) => Number(i.size_ml)), body.items.map((i) => i.slug)]
  );
  const priceMap = new Map<string, { fragrance_id: number; brand: string; name: string; full_name: string; price_cents: number }>();
  for (const r of itemsRes.rows) {
    priceMap.set(`${r.slug}:${r.size_ml}`, {
      fragrance_id: r.fragrance_id, brand: r.brand, name: r.name,
      full_name: r.full_name, price_cents: r.price_cents ?? 0
    });
  }

  let subtotalCents = 0;
  const orderItems: Array<{
    fragrance_id: number; fragrance_slug: string; fragrance_brand: string;
    fragrance_name: string; size_ml: number; unit_price_cents: number; qty: number;
    line_total_cents: number;
  }> = [];

  for (const ci of body.items) {
    const p = priceMap.get(`${ci.slug}:${ci.size_ml}`);
    if (!p) return NextResponse.json({ error: `Producto no encontrado: ${ci.slug}` }, { status: 400 });
    const qty = Math.max(1, Math.min(99, Number(ci.qty)));
    const lineTotal = p.price_cents * qty;
    subtotalCents += lineTotal;
    orderItems.push({
      fragrance_id: p.fragrance_id, fragrance_slug: ci.slug, fragrance_brand: p.brand,
      fragrance_name: p.name, size_ml: Number(ci.size_ml),
      unit_price_cents: p.price_cents, qty, line_total_cents: lineTotal
    });
  }

  const zone = (await pool.query<{ name: string; cost_cents: number; free_from_cents: number | null; kind: string; pickup_address: string | null; pickup_city: string | null; pickup_state: string | null; pickup_postal_code: string | null }>(
    `SELECT name, cost_cents, free_from_cents, kind,
            pickup_address, pickup_city, pickup_state, pickup_postal_code
     FROM shipping_zone WHERE id = $1 AND active = TRUE`,
    [Number(body.shipping.zone_id)]
  )).rows[0];
  if (!zone) return NextResponse.json({ error: "Zona de envío no válida" }, { status: 400 });
  const isPickup = body.shipping.kind === "pickup" || zone.kind === "pickup";
  let shippingCents = 0;
  if (zone.kind !== "pickup") {
    shippingCents = zone.cost_cents;
    if (zone.free_from_cents && subtotalCents >= zone.free_from_cents) shippingCents = 0;
  }
  const shipName = zone.name;
  const shipLine = isPickup ? (zone.pickup_address ?? "Recogida en sitio") : body.shipping.address_line;
  const shipLine2 = isPickup ? null : (body.shipping.address_line2 ?? null);
  const shipCity = isPickup ? (zone.pickup_city ?? "") : body.shipping.city;
  const shipState = isPickup ? (zone.pickup_state ?? "") : body.shipping.state;
  const shipCP = isPickup ? (zone.pickup_postal_code ?? "") : body.shipping.postal_code;
  if (!shipLine) return NextResponse.json({ error: "Dirección de envío requerida" }, { status: 400 });

  let discountCents = 0;
  let couponCode: string | null = null;
  if (body.coupon_code) {
    const c = (await pool.query<{ type: string; value: number; min_subtotal_cents: number | null; expires_at: string | null; usage_limit: number | null; usage_count: number; active: boolean }>(
      `SELECT type, value, min_subtotal_cents, expires_at, usage_limit, usage_count, active FROM coupon WHERE code = $1`,
      [String(body.coupon_code).toUpperCase()]
    )).rows[0];
    if (c && c.active && (!c.expires_at || new Date(c.expires_at) > new Date())
        && (!c.usage_limit || c.usage_count < c.usage_limit)
        && (!c.min_subtotal_cents || subtotalCents >= c.min_subtotal_cents)) {
      couponCode = body.coupon_code!.toUpperCase();
      discountCents = c.type === "percent" ? Math.round(subtotalCents * (c.value / 100)) : Math.min(subtotalCents, c.value);
    }
  }
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  // 2) Crear la orden
  const publicId = `PLT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const orderRes = await pool.query<{ id: number }>(
    `INSERT INTO "order"
       (public_id, status, customer_email, customer_name, customer_phone,
        shipping_zone_name, shipping_address_line, shipping_address_line2,
        shipping_city, shipping_state, shipping_postal_code, shipping_country,
        subtotal_cents, discount_cents, shipping_cents, total_cents, currency,
        coupon_code, provider, status_history)
     VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, 'stripe',
             jsonb_build_array(jsonb_build_object('status','pending','at',to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))))
     RETURNING id`,
    [
      publicId, body.customer.email, body.customer.name, body.customer.phone ?? null,
      shipName, shipLine, shipLine2,
      shipCity, shipState, shipCP,
      body.shipping.country ?? "MX",
      subtotalCents, discountCents, shippingCents, totalCents, "MXN", couponCode
    ]
  );
  const orderId = orderRes.rows[0].id;
  for (const oi of orderItems) {
    await pool.query(
      `INSERT INTO order_item
         (order_id, fragrance_id, fragrance_slug, fragrance_brand, fragrance_name,
          size_ml, unit_price_cents, qty, line_total_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [orderId, oi.fragrance_id, oi.fragrance_slug, oi.fragrance_brand, oi.fragrance_name,
       oi.size_ml, oi.unit_price_cents, oi.qty, oi.line_total_cents]
    );
  }

  // 3) Crear Checkout Session en Stripe
  // Construir origin público desde headers de proxy (Railway usa
  // x-forwarded-proto / x-forwarded-host, no req.nextUrl.origin que
  // devuelve localhost:8080).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const origin = `${proto}://${host}`;
  const lineItems = orderItems.map((oi) => ({
    quantity: oi.qty,
    price_data: {
      currency: "mxn",
      unit_amount: oi.unit_price_cents,
      product_data: {
        name: `${oi.fragrance_brand} ${oi.fragrance_name} (${oi.size_ml}ml)`,
        description: "Polianthes · perfume inspirado"
      }
    }
  }));
  if (shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: shippingCents,
        product_data: { name: `Envío · ${zone.name}`, description: "Costo de envío calculado" }
      }
    });
  }

  // Stripe no acepta amount negativo; si hay descuento, lo aplicamos como
  // cupón de Stripe (requiere crear uno previamente) o lo registramos en
  // metadata y se ajusta en el webhook. Por simplicidad, lo dejamos en
  // metadata y el webhook ajusta el monto final en la orden.
  const form = new FormData();
  form.append("mode", "payment");
  form.append("success_url", `${origin}/checkout/ok?order=${publicId}`);
  form.append("cancel_url", `${origin}/checkout/failed?order=${publicId}`);
  form.append("client_reference_id", publicId);
  form.append("customer_email", body.customer.email);
  form.append("metadata[order_id]", String(orderId));
  form.append("metadata[public_id]", publicId);
  form.append("payment_intent_data[metadata][order_id]", String(orderId));
  form.append("payment_intent_data[metadata][public_id]", publicId);
  // Si hay descuento, lo aplicamos como descuento total con coupon_id propio de Stripe
  // (requiere crear un coupon previamente; por ahora registramos en metadata)
  if (discountCents > 0) {
    form.append("metadata[discount_cents]", String(discountCents));
  }
  lineItems.forEach((li, i) => {
    form.append(`line_items[${i}][quantity]`, String(li.quantity));
    form.append(`line_items[${i}][price_data][currency]`, li.price_data.currency);
    form.append(`line_items[${i}][price_data][unit_amount]`, String(li.price_data.unit_amount));
    form.append(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name);
    if (li.price_data.product_data.description) {
      form.append(`line_items[${i}][price_data][product_data][description]`, li.price_data.product_data.description);
    }
  });

  let sRes: Response;
  try {
    sRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.stripe_secret_key}` },
      body: form,
      signal: AbortSignal.timeout(15000)
    });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo conectar con Stripe", detail: e instanceof Error ? e.message : "" }, { status: 502 });
  }

  if (!sRes.ok) {
    const errText = await sRes.text();
    return NextResponse.json({ error: "Stripe rechazó la sesión", status: sRes.status, detail: errText }, { status: 502 });
  }

  const session = await sRes.json();
  await pool.query(
    `UPDATE "order" SET stripe_payment_intent = $1 WHERE id = $2`,
    [session.payment_intent ?? null, orderId]
  );

  return NextResponse.json({
    order_id: orderId,
    public_id: publicId,
    session_id: session.id,
    url: session.url
  });
}

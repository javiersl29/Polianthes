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
  customer: {
    email: string;
    name: string;
    phone?: string;
  };
  shipping: {
    zone_id: number;
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
 * POST /api/checkout/mercadopago
 * Crea una orden en DB y genera una Preference de MercadoPago.
 * Devuelve { init_point, order_id, public_id }.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!body.customer?.email || !body.customer?.name) {
    return NextResponse.json({ error: "Faltan datos del cliente" }, { status: 400 });
  }
  if (!body.shipping?.address_line || !body.shipping?.postal_code) {
    return NextResponse.json({ error: "Faltan datos de envío" }, { status: 400 });
  }

  const cfg = await getPaymentProvider("mercadopago");
  if (!cfg || !cfg.active) {
    return NextResponse.json({ error: "MercadoPago no está activo. Configúralo en /admin/pagos" }, { status: 503 });
  }
  if (!cfg.mp_access_token) {
    return NextResponse.json({ error: "Falta el access token de MercadoPago" }, { status: 503 });
  }

  const pool = getPool();

  // 1) Cargar precios reales de la DB (no confiar en el cliente)
  const itemsRes = await pool.query<{
    fragrance_id: number;
    slug: string;
    brand: string;
    name: string;
    full_name: string;
    size_ml: number;
    price_cents: number;
    active: boolean;
  }>(
    `SELECT f.id AS fragrance_id, f.slug, f.brand, f.name, f.full_name,
            p.size_ml, p.price_cents, p.active
     FROM presentation p
     JOIN fragrance f ON f.id = p.fragrance_id
     WHERE f.active = TRUE AND p.size_ml = ANY($1::int[])
       AND f.slug = ANY($2::text[])`,
    [body.items.map((i) => Number(i.size_ml)), body.items.map((i) => i.slug)]
  );

  const priceMap = new Map<string, { fragrance_id: number; brand: string; name: string; full_name: string; price_cents: number; image_url: string | null }>();
  let imageJoined: { slug: string; image_url: string | null }[] = [];
  try {
    imageJoined = (await pool.query<{ slug: string; image_url: string | null }>(
      `SELECT slug,
              CASE WHEN image_data IS NOT NULL THEN '/api/image/' || slug
                   WHEN image_url LIKE '/fragancias/%' THEN NULL
                   ELSE image_url END AS image_url
       FROM fragrance WHERE slug = ANY($1::text[])`,
      [body.items.map((i) => i.slug)]
    )).rows;
  } catch { /* ok */ }

  for (const r of itemsRes.rows) {
    priceMap.set(`${r.slug}:${r.size_ml}`, {
      fragrance_id: r.fragrance_id,
      brand: r.brand,
      name: r.name,
      full_name: r.full_name,
      price_cents: r.price_cents ?? 0,
      image_url: imageJoined.find((i) => i.slug === r.slug)?.image_url ?? null
    });
  }

  // 2) Calcular subtotal
  let subtotalCents = 0;
  const orderItems: Array<{
    fragrance_id: number; fragrance_slug: string; fragrance_brand: string;
    fragrance_name: string; size_ml: number; unit_price_cents: number; qty: number;
    line_total_cents: number; fragrance_image_url: string | null;
  }> = [];

  for (const ci of body.items) {
    const key = `${ci.slug}:${ci.size_ml}`;
    const p = priceMap.get(key);
    if (!p) {
      return NextResponse.json({ error: `Producto no encontrado: ${ci.slug} ${ci.size_ml}ml` }, { status: 400 });
    }
    if (p.price_cents <= 0) {
      return NextResponse.json({ error: `Precio no disponible para ${p.full_name}` }, { status: 400 });
    }
    const qty = Math.max(1, Math.min(99, Number(ci.qty)));
    const lineTotal = p.price_cents * qty;
    subtotalCents += lineTotal;
    orderItems.push({
      fragrance_id: p.fragrance_id,
      fragrance_slug: ci.slug,
      fragrance_brand: p.brand,
      fragrance_name: p.name,
      size_ml: Number(ci.size_ml),
      unit_price_cents: p.price_cents,
      qty,
      line_total_cents: lineTotal,
      fragrance_image_url: p.image_url
    });
  }

  // 3) Calcular envío desde la zona
  const zone = (await pool.query<{
    name: string; cost_cents: number; free_from_cents: number | null;
  }>(
    `SELECT name, cost_cents, free_from_cents FROM shipping_zone
     WHERE id = $1 AND active = TRUE`,
    [Number(body.shipping.zone_id)]
  )).rows[0];
  if (!zone) {
    return NextResponse.json({ error: "Zona de envío no válida" }, { status: 400 });
  }
  let shippingCents = zone.cost_cents;
  if (zone.free_from_cents && subtotalCents >= zone.free_from_cents) {
    shippingCents = 0;
  }

  // 4) Calcular cupón
  let discountCents = 0;
  let couponCode: string | null = null;
  if (body.coupon_code) {
    const c = (await pool.query<{
      id: number; type: string; value: number; min_subtotal_cents: number | null;
      expires_at: string | null; usage_limit: number | null; usage_count: number; active: boolean;
    }>(
      `SELECT id, type, value, min_subtotal_cents, expires_at, usage_limit, usage_count, active
       FROM coupon WHERE code = $1`,
      [String(body.coupon_code).toUpperCase()]
    )).rows[0];
    if (c && c.active && (!c.expires_at || new Date(c.expires_at) > new Date())
        && (!c.usage_limit || c.usage_count < c.usage_limit)
        && (!c.min_subtotal_cents || subtotalCents >= c.min_subtotal_cents)) {
      couponCode = body.coupon_code!.toUpperCase();
      discountCents = c.type === "percent"
        ? Math.round(subtotalCents * (c.value / 100))
        : Math.min(subtotalCents, c.value);
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  // 5) Crear la orden en DB (status=pending hasta webhook)
  const publicId = `PLT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const orderRes = await pool.query<{ id: number }>(
    `INSERT INTO "order"
       (public_id, status, customer_email, customer_name, customer_phone,
        shipping_zone_name, shipping_address_line, shipping_address_line2,
        shipping_city, shipping_state, shipping_postal_code, shipping_country,
        subtotal_cents, discount_cents, shipping_cents, total_cents, currency,
        coupon_code, provider, status_history)
     VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, 'mercadopago',
             jsonb_build_array(jsonb_build_object('status','pending','at',to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))))
     RETURNING id`,
    [
      publicId,
      body.customer.email, body.customer.name, body.customer.phone ?? null,
      zone.name, body.shipping.address_line, body.shipping.address_line2 ?? null,
      body.shipping.city, body.shipping.state, body.shipping.postal_code,
      body.shipping.country ?? "MX",
      subtotalCents, discountCents, shippingCents, totalCents, "MXN", couponCode
    ]
  );
  const orderId = orderRes.rows[0].id;

  for (const oi of orderItems) {
    await pool.query(
      `INSERT INTO order_item
         (order_id, fragrance_id, fragrance_slug, fragrance_brand, fragrance_name,
          size_ml, unit_price_cents, qty, line_total_cents, fragrance_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderId, oi.fragrance_id, oi.fragrance_slug, oi.fragrance_brand, oi.fragrance_name,
       oi.size_ml, oi.unit_price_cents, oi.qty, oi.line_total_cents, oi.fragrance_image_url]
    );
  }

  // 6) Crear Preference en MercadoPago
  const origin = req.nextUrl.origin;
  const items_mp = orderItems.map((oi) => ({
    id: String(oi.fragrance_id),
    title: `${oi.fragrance_brand} ${oi.fragrance_name} (${oi.size_ml}ml)`,
    description: "Polianthes · perfume inspirado",
    picture_url: oi.fragrance_image_url ? `${origin}${oi.fragrance_image_url}` : undefined,
    category_id: "fragrances",
    quantity: oi.qty,
    currency_id: "MXN",
    unit_price: oi.unit_price_cents / 100
  }));

  if (shippingCents > 0) {
    items_mp.push({
      id: "shipping",
      title: `Envío · ${zone.name}`,
      category_id: "shipping",
      quantity: 1,
      currency_id: "MXN",
      unit_price: shippingCents / 100
    } as typeof items_mp[number]);
  }

  const preferenceBody = {
    items: items_mp,
    payer: {
      name: body.customer.name,
      email: body.customer.email,
      phone: body.customer.phone ? { number: String(body.customer.phone) } : undefined
    },
    back_urls: {
      success: `${origin}/checkout/ok?order=${publicId}`,
      failure: `${origin}/checkout/failed?order=${publicId}`,
      pending: `${origin}/checkout/pending?order=${publicId}`
    },
    auto_return: "approved",
    external_reference: publicId,
    notification_url: `${origin}/api/webhooks/mercadopago`,
    statement_descriptor: "POLIANTHES",
    metadata: { order_id: orderId, public_id: publicId }
  };

  let mpRes: Response;
  try {
    mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.mp_access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": publicId
      },
      body: JSON.stringify(preferenceBody),
      signal: AbortSignal.timeout(15000)
    });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo conectar con MercadoPago", detail: e instanceof Error ? e.message : "" },
      { status: 502 }
    );
  }

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    return NextResponse.json(
      { error: "MercadoPago rechazó la preference", status: mpRes.status, detail: errText },
      { status: 502 }
    );
  }

  const pref = await mpRes.json();
  await pool.query(
    `UPDATE "order" SET mp_preference_id = $1 WHERE id = $2`,
    [pref.id, orderId]
  );

  return NextResponse.json({
    order_id: orderId,
    public_id: publicId,
    preference_id: pref.id,
    init_point: cfg.mode === "test" ? pref.sandbox_init_point : pref.init_point
  });
}

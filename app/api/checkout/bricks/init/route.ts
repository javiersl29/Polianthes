import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";
import { parseMXN } from "@/lib/money";
import { getCurrentCustomer, markCustomerAffiliated, incrementCustomerStats } from "@/lib/customer-auth";

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
  promo?: {
    slug: string;
    type: string;
    value: number;
    quantity_to_take: number;
    quantity_to_pay: number;
  };
};

/**
 * POST /api/checkout/bricks/init
 * Crea la orden en DB y una preferencia mínima en MP (para habilitar
 * pago con Mercado Pago/Cuenta dentro del brick). Devuelve:
 *  - public_key: para inicializar el SDK de MP en el frontend
 *  - preference_id: para el brick
 *  - amount: monto total en MXN (float)
 *  - order_id, public_id: identificadores de la orden
 *  - init_point: en caso de fallback a Checkout Pro (redirección)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!body.customer?.email || !body.customer?.name) {
    return NextResponse.json({ error: "Faltan datos del cliente" }, { status: 400 });
  }
  if (!body.shipping?.zone_id) {
    return NextResponse.json({ error: "Falta la zona de envío o sitio de entrega" }, { status: 400 });
  }

  const cfg = await getPaymentProvider("mercadopago");
  if (!cfg || !cfg.active || !cfg.mp_access_token) {
    return NextResponse.json({ error: "MercadoPago no está configurado" }, { status: 503 });
  }
  if (!cfg.mp_public_key) {
    return NextResponse.json({ error: "Falta la Public Key de MercadoPago. Pégala en /admin/pagos" }, { status: 503 });
  }

  const pool = getPool();
  const isPickup = body.shipping.kind === "pickup";

  // 1) Cargar precios reales de la DB
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
      fragrance_id: r.fragrance_id, brand: r.brand, name: r.name,
      full_name: r.full_name, price_cents: r.price_cents ?? 0,
      image_url: imageJoined.find((i) => i.slug === r.slug)?.image_url ?? null
    });
  }

  let subtotalCents = 0;
  const orderItems: Array<{
    fragrance_id: number; fragrance_slug: string; fragrance_brand: string;
    fragrance_name: string; size_ml: number; unit_price_cents: number; qty: number;
    line_total_cents: number; fragrance_image_url: string | null;
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
      unit_price_cents: p.price_cents, qty, line_total_cents: lineTotal,
      fragrance_image_url: p.image_url
    });
  }

  // 2) Calcular envío
  const zone = (await pool.query<{ name: string; cost_cents: number; free_from_cents: number | null; kind: string; pickup_address: string | null; pickup_city: string | null; pickup_state: string | null; pickup_postal_code: string | null }>(
    `SELECT name, cost_cents, free_from_cents, kind,
            pickup_address, pickup_city, pickup_state, pickup_postal_code
     FROM shipping_zone WHERE id = $1 AND active = TRUE`,
    [Number(body.shipping.zone_id)]
  )).rows[0];
  if (!zone) return NextResponse.json({ error: "Zona de envío no válida" }, { status: 400 });

  let shippingCents = 0;
  if (zone.kind !== "pickup" && !isPickup) {
    shippingCents = zone.cost_cents;
    if (zone.free_from_cents && subtotalCents >= zone.free_from_cents) shippingCents = 0;
  }
  const shipName = zone.name;
  const shipLine = isPickup ? (zone.pickup_address ?? "Recogida en sitio") : body.shipping.address_line;
  const shipLine2 = isPickup ? null : (body.shipping.address_line2 ?? null);
  const shipCity = isPickup ? (zone.pickup_city ?? "") : body.shipping.city;
  const shipState = isPickup ? (zone.pickup_state ?? "") : body.shipping.state;
  const shipCP = isPickup ? (zone.pickup_postal_code ?? "") : body.shipping.postal_code;

  // 3) Cupón
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

  // 4) Promoción (3x2, 2x1, percent, fixed) — valida desde la DB
  let promoApplied = false;
  let promoSummary = "";
  if (body.promo?.slug) {
    const pr = (await pool.query<{
      type: string; value: number; required_size_ml: number;
      quantity_to_take: number; quantity_to_pay: number;
      min_items: number; max_items: number;
      starts_at: string | null; ends_at: string | null; active: boolean;
      title: string;
    }>(
      `SELECT type, value, required_size_ml, quantity_to_take, quantity_to_pay,
              min_items, max_items, starts_at, ends_at, active, title
       FROM promotion
       WHERE slug = $1`,
      [String(body.promo.slug)]
    )).rows[0];

    if (pr && pr.active
        && (!pr.starts_at || new Date(pr.starts_at) <= new Date())
        && (!pr.ends_at || new Date(pr.ends_at) >= new Date())) {
      const totalItems = orderItems.reduce((s, oi) => s + oi.qty, 0);

      if (pr.type === "3x2" || pr.type === "2x1") {
        const take = pr.quantity_to_take || (pr.type === "3x2" ? 3 : 2);
        const pay = pr.quantity_to_pay || (pr.type === "3x2" ? 2 : 1);
        if (totalItems >= take) {
          // Cobrar solo los `pay` items más baratos
          const allUnitPrices = orderItems.flatMap((oi) => Array(oi.qty).fill(oi.unit_price_cents));
          allUnitPrices.sort((a, b) => a - b);
          const freeCount = take - pay;
          const freeAmount = allUnitPrices.slice(0, freeCount).reduce((s, p) => s + p, 0);
          discountCents = freeAmount;
          couponCode = `[${pr.type.toUpperCase()}] ${pr.title}`;
          promoApplied = true;
          promoSummary = `${pr.type.toUpperCase()}: lleva ${take} y paga ${pay}`;
        }
      } else if (pr.type === "percent") {
        const d = Math.round(subtotalCents * (pr.value / 100));
        discountCents = Math.max(discountCents, d);
        couponCode = `[PROMO ${pr.value}%] ${pr.title}`;
        promoApplied = true;
        promoSummary = `${pr.value}% de descuento`;
      } else if (pr.type === "fixed") {
        discountCents = Math.max(discountCents, Math.min(subtotalCents, pr.value));
        couponCode = `[PROMO $${(pr.value / 100).toFixed(0)}] ${pr.title}`;
        promoApplied = true;
        promoSummary = `$${(pr.value / 100).toFixed(0)} de descuento`;
      } else if (pr.type === "free_shipping") {
        if (shippingCents > 0) {
          // Guardar como cupón representativo, pero también ajustar envío a 0
          couponCode = `[ENVÍO GRATIS] ${pr.title}`;
          shippingCents = 0;
          promoApplied = true;
          promoSummary = "Envío gratis";
        }
      }
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  // 4) Crear orden en DB
  const publicId = `PLT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const customer = await getCurrentCustomer();
  const customerId = customer?.id ?? null;
  const orderRes = await pool.query<{ id: number }>(
    `INSERT INTO "order"
       (public_id, status, customer_email, customer_name, customer_phone,
        shipping_zone_name, shipping_address_line, shipping_address_line2,
        shipping_city, shipping_state, shipping_postal_code, shipping_country,
        subtotal_cents, discount_cents, shipping_cents, total_cents, currency,
        coupon_code, provider, status_history, customer_id)
     VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, 'mercadopago',
             jsonb_build_array(jsonb_build_object('status','pending','at',to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
             $18)
     RETURNING id`,
    [
      publicId, body.customer.email, body.customer.name, body.customer.phone ?? null,
      shipName, shipLine, shipLine2, shipCity, shipState, shipCP,
      body.shipping.country ?? "MX",
      subtotalCents, discountCents, shippingCents, totalCents, "MXN", couponCode,
      customerId
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

  // 5) Crear preferencia mínima en MP. Esta preference sólo se usa para
  //    que el brick pueda ofrecer "Cuenta Mercado Pago" / "Meses sin Tarjeta"
  //    como métodos. NO se usa para redirección (el brick procesa todo in-site).
  const origin = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host}`;

  const prefBody = {
    items: [{
      id: String(orderId),
      title: `Pedido Polianthes ${publicId}`,
      description: "Compra en Polianthes",
      category_id: "fragrances",
      quantity: 1,
      currency_id: "MXN",
      unit_price: totalCents / 100
    }],
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

  let preferenceId: string | null = null;
  try {
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.mp_access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": publicId
      },
      body: JSON.stringify(prefBody),
      signal: AbortSignal.timeout(15000)
    });
    if (mpRes.ok) {
      const pref = await mpRes.json();
      preferenceId = pref.id;
      await pool.query(`UPDATE "order" SET mp_preference_id = $1 WHERE id = $2`, [pref.id, orderId]);
    }
    // Si la preference falla, no bloqueamos: el brick puede seguir
    // funcionando sin ella (sólo no ofrecerá Cuenta Mercado Pago).
  } catch { /* ok, seguir sin preference */ }

  return NextResponse.json({
    public_key: cfg.mp_public_key,
    preference_id: preferenceId,
    amount: totalCents / 100,
    order_id: orderId,
    public_id: publicId,
    mode: cfg.mode
  });
}

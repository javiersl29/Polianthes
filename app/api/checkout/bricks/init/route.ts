import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getPaymentProvider } from "@/lib/admin-data";
import { parseMXN } from "@/lib/money";
import { getCurrentCustomer, markCustomerAffiliated, incrementCustomerStats } from "@/lib/customer-auth";
import { calculatePromo } from "@/lib/promo-calc";
import { calculateShipping } from "@/lib/shipping";

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
  if (!body.shipping) {
    return NextResponse.json({ error: "Faltan datos de envío" }, { status: 400 });
  }
  // En modo pickup sí se requiere zone_id (sitio específico)
  // En modo shipping, zone_id puede no existir si hay override o default global
  if (body.shipping.kind === "pickup" && !body.shipping.zone_id) {
    return NextResponse.json({ error: "Selecciona un sitio de entrega" }, { status: 400 });
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

  // 2) Cupón
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

  // 3) Promoción — usa calculatePromo de lib/promo-calc (misma lógica que el carrito client-side)
  let promoApplied = false;
  let promoSummary = "";
  let promoType: string | null = null;
  if (body.promo?.slug) {
    const pr = (await pool.query<{
      type: string; value: number; bundle_price_cents: number; required_size_ml: number; mix_sizes: boolean; mix_config: any;
      quantity_to_take: number; quantity_to_pay: number;
      min_items: number; max_items: number; min_subtotal_cents: number;
      starts_at: string | null; ends_at: string | null; active: boolean;
      title: string;
    }>(
      `SELECT type, value, bundle_price_cents, required_size_ml, mix_sizes, mix_config,
              quantity_to_take, quantity_to_pay,
              min_items, max_items, min_subtotal_cents, starts_at, ends_at, active, title
       FROM promotion
       WHERE slug = $1`,
      [String(body.promo.slug)]
    )).rows[0];

    if (pr && pr.active
        && (!pr.starts_at || new Date(pr.starts_at) <= new Date())
        && (!pr.ends_at || new Date(pr.ends_at) >= new Date())) {

      promoType = pr.type;

      // Parsear mix_config
      let mixConfig: Array<{ size_ml: number; qty: number }> | null = null;
      if (pr.mix_config && Array.isArray(pr.mix_config)) {
        mixConfig = pr.mix_config;
      } else if (typeof pr.mix_config === "string") {
        try { mixConfig = JSON.parse(pr.mix_config); } catch { /* ignore */ }
      }

      const promoResult = calculatePromo(
        orderItems.map((oi) => ({
          size_ml: oi.size_ml,
          qty: oi.qty,
          unit_price_cents: oi.unit_price_cents,
        })),
        {
          type: pr.type,
          value: pr.value,
          bundle_price_cents: pr.bundle_price_cents,
          quantity_to_take: pr.quantity_to_take,
          quantity_to_pay: pr.quantity_to_pay,
          min_subtotal_cents: pr.min_subtotal_cents,
          mix_config: mixConfig,
          required_size_ml: pr.required_size_ml,
          mix_sizes: pr.mix_sizes,
        }
      );

      if (promoResult.valid) {
        discountCents = promoResult.discount_cents;
        promoApplied = true;
        promoSummary = promoResult.summary;

        // Construir couponCode descriptivo (no toca shippingCents: ya lo aplicó calculateShipping)
        if (pr.type === "free_shipping") {
          couponCode = `[ENVÍO GRATIS] ${pr.title}`;
        } else {
          couponCode = `[PROMO] ${pr.title}`;
        }
      } else {
        promoSummary = promoResult.reason ?? "Promoción no aplicable";
      }
    } else {
      promoSummary = "Promoción no vigente";
    }
  }

  // 4) Calcular envío (centralizado en lib/shipping.ts) — DESPUÉS de cupón/promo
  const isFreeShippingPromo = promoType === "free_shipping";
  const shippingResult = await calculateShipping({
    deliveryMode: isPickup ? "pickup" : "shipping",
    postalCode: body.shipping.postal_code ?? null,
    subtotalPreCents: subtotalCents,
    subtotalPostCents: subtotalCents - discountCents,
    shippingAddress: {
      address_line: body.shipping.address_line,
      address_line2: body.shipping.address_line2 ?? null,
      city: body.shipping.city,
      state: body.shipping.state,
      postal_code: body.shipping.postal_code
    },
    hasFreeShippingPromo: isFreeShippingPromo,
    explicitZoneId: body.shipping.zone_id ?? null
  });
  // Validar que la zona explícita del cliente existe (no aceptar ids inventados)
  if (body.shipping.zone_id && !shippingResult.zone_id) {
    return NextResponse.json({ error: "Zona de envío no válida" }, { status: 400 });
  }
  const shippingCents = shippingResult.shipping_cents;
  const shipName = shippingResult.zone_name;
  const shipLine = shippingResult.address.line;
  const shipLine2 = shippingResult.address.line2;
  const shipCity = shippingResult.address.city;
  const shipState = shippingResult.address.state;
  const shipCP = shippingResult.address.postal_code;

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

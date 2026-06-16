/**
 * Acceso a datos para los paneles de administración.
 * Centraliza las SQL queries para usuarios, órdenes, envíos,
 * pagos y estadísticas. Todas las funciones asumen que el
 * llamador ya verificó `isAuthenticated()`.
 */
import { query } from "./db";

// ──────────────────────────────────────────────────────────────
// Usuarios
// ──────────────────────────────────────────────────────────────

export type AdminUser = {
  id: number;
  username: string;
  created_at: string;
};

export async function listAdminUsers(): Promise<AdminUser[]> {
  const r = await query<AdminUser>(
    `SELECT id, username, created_at FROM admin_user ORDER BY created_at`
  );
  return r.rows;
}

export async function countAdminUsers(): Promise<number> {
  const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM admin_user`);
  return Number(r.rows[0]?.c ?? 0);
}

// ──────────────────────────────────────────────────────────────
// Órdenes / pedidos
// ──────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "in_transit"
  | "delivered";

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pendiente", color: "text-amber-300 border-amber-300/30 bg-amber-400/10" },
  { value: "approved", label: "Aprobado", color: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10" },
  { value: "rejected", label: "Rechazado", color: "text-rose-300 border-rose-300/30 bg-rose-400/10" },
  { value: "cancelled", label: "Cancelado", color: "text-ink-mute border-white/10 bg-white/5" },
  { value: "refunded", label: "Reembolsado", color: "text-violet-300 border-violet-300/30 bg-violet-400/10" },
  { value: "in_transit", label: "En tránsito", color: "text-sky-300 border-sky-300/30 bg-sky-400/10" },
  { value: "delivered", label: "Entregado", color: "text-gold border-gold/30 bg-gold/10" }
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.value, s.label])
) as Record<OrderStatus, string>;

export type AdminOrder = {
  id: number;
  public_id: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_zone_name: string;
  shipping_address_line: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  coupon_code: string | null;
  provider: string | null;
  mp_payment_id: string | null;
  stripe_payment_intent: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  status_history: Array<{ status: OrderStatus; at: string; note?: string }>;
  items_count: number;
  items_qty: number;
};

export async function listAdminOrders(limit = 100): Promise<AdminOrder[]> {
  const r = await query<AdminOrder>(
    `SELECT o.*,
            COALESCE(
              (SELECT json_agg(json_build_object('status', h->>'status', 'at', h->>'at', 'note', h->>'note'))
               FROM jsonb_array_elements(o.status_history) AS h),
              '[]'::json
            ) AS status_history,
            COALESCE((SELECT COUNT(*) FROM order_item WHERE order_id = o.id), 0)::int AS items_count,
            COALESCE((SELECT SUM(qty) FROM order_item WHERE order_id = o.id), 0)::int AS items_qty
     FROM "order" o
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export async function getAdminOrder(id: number): Promise<AdminOrder | null> {
  const r = await query<AdminOrder>(
    `SELECT o.*,
            COALESCE(
              (SELECT json_agg(json_build_object('status', h->>'status', 'at', h->>'at', 'note', h->>'note'))
               FROM jsonb_array_elements(o.status_history) AS h),
              '[]'::json
            ) AS status_history,
            COALESCE((SELECT COUNT(*) FROM order_item WHERE order_id = o.id), 0)::int AS items_count,
            COALESCE((SELECT SUM(qty) FROM order_item WHERE order_id = o.id), 0)::int AS items_qty
     FROM "order" o WHERE o.id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function getOrderItems(orderId: number) {
  const r = await query(
    `SELECT oi.*, f.slug AS current_slug, f.display_code, f.artistic_name
     FROM order_item oi
     LEFT JOIN fragrance f ON f.id = oi.fragrance_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );
  return r.rows;
}

export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
  note?: string
): Promise<void> {
  await query(
    `UPDATE "order"
     SET status = $1::text,
          updated_at = NOW(),
          status_history = status_history || jsonb_build_array(
            jsonb_build_object('status', $1::text, 'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note', COALESCE($2::text, ''))
          ),
          paid_at = CASE WHEN $1::text = 'approved' AND paid_at IS NULL THEN NOW() ELSE paid_at END
     WHERE id = $3`,
    [status, note ?? null, id]
  );
}

export async function updateOrderTracking(
  id: number,
  carrier: string | null,
  trackingNumber: string | null,
  trackingUrl: string | null
): Promise<void> {
  await query(
    `UPDATE "order"
     SET carrier = $1, tracking_number = $2, tracking_url = $3, updated_at = NOW()
     WHERE id = $4`,
    [carrier ?? null, trackingNumber ?? null, trackingUrl ?? null, id]
  );
}

export async function updateOrderNotes(id: number, notes: string | null): Promise<void> {
  await query(`UPDATE "order" SET notes = $1, updated_at = NOW() WHERE id = $2`, [notes ?? null, id]);
}

// ──────────────────────────────────────────────────────────────
// Zonas de envío
// ──────────────────────────────────────────────────────────────

export type ShippingZone = {
  id: number;
  name: string;
  postal_code_prefix: string;
  cost_cents: number;
  free_from_cents: number | null;
  estimated_days: string | null;
  active: boolean;
  display_order: number;
  // Pickup (entrega física)
  kind: "shipping" | "pickup";
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_schedule: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export async function listShippingZones(): Promise<ShippingZone[]> {
  const r = await query<ShippingZone>(
    `SELECT * FROM shipping_zone ORDER BY kind, display_order, name`
  );
  return r.rows;
}

export async function upsertShippingZone(z: Partial<ShippingZone> & { name: string }): Promise<number> {
  const kind = z.kind === "pickup" ? "pickup" : "shipping";
  // Para pickup, costo y CP no aplican (envío es gratis y no hay zona)
  const costCents = kind === "pickup" ? 0 : (z.cost_cents ?? 0);
  const cpPrefix = kind === "pickup" ? "" : (z.postal_code_prefix ?? "");
  if (z.id) {
    await query(
      `UPDATE shipping_zone
       SET name = $1, kind = $2, postal_code_prefix = $3, cost_cents = $4,
           free_from_cents = $5, estimated_days = $6, active = $7, display_order = $8,
           pickup_address = $9, pickup_city = $10, pickup_state = $11,
           pickup_postal_code = $12, pickup_schedule = $13,
           pickup_lat = $14, pickup_lng = $15,
           phone = $16, email = $17
       WHERE id = $18`,
      [
        z.name, kind, cpPrefix, costCents,
        z.free_from_cents ?? null, z.estimated_days ?? null,
        z.active ?? true, z.display_order ?? 0,
        z.pickup_address ?? null, z.pickup_city ?? null, z.pickup_state ?? null,
        z.pickup_postal_code ?? null, z.pickup_schedule ?? null,
        z.pickup_lat ?? null, z.pickup_lng ?? null,
        z.phone ?? null, z.email ?? null,
        z.id
      ]
    );
    return z.id;
  }
  const r = await query<{ id: number }>(
    `INSERT INTO shipping_zone
       (name, kind, postal_code_prefix, cost_cents, free_from_cents, estimated_days,
        active, display_order, pickup_address, pickup_city, pickup_state,
        pickup_postal_code, pickup_schedule, pickup_lat, pickup_lng, phone, email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id`,
    [
      z.name, kind, cpPrefix, costCents,
      z.free_from_cents ?? null, z.estimated_days ?? null,
      z.active ?? true, z.display_order ?? 0,
      z.pickup_address ?? null, z.pickup_city ?? null, z.pickup_state ?? null,
      z.pickup_postal_code ?? null, z.pickup_schedule ?? null,
      z.pickup_lat ?? null, z.pickup_lng ?? null,
      z.phone ?? null, z.email ?? null
    ]
  );
  return r.rows[0].id;
}

export async function deleteShippingZone(id: number): Promise<void> {
  await query(`DELETE FROM shipping_zone WHERE id = $1`, [id]);
}

// ──────────────────────────────────────────────────────────────
// Configuración de pagos
// ──────────────────────────────────────────────────────────────

export type PaymentProvider = "mercadopago" | "stripe";

export type PaymentProviderConfig = {
  id: number;
  provider: PaymentProvider;
  active: boolean;
  mp_access_token: string | null;
  mp_public_key: string | null;
  mp_webhook_secret: string | null;
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
  mode: "test" | "live";
  currency: string;
  installments_min: number;
  installments_max: number;
  notes: string | null;
  updated_at: string;
};

export async function listPaymentProviders(): Promise<PaymentProviderConfig[]> {
  const r = await query<PaymentProviderConfig>(
    `SELECT * FROM payment_provider_config ORDER BY provider`
  );
  return r.rows;
}

export async function getPaymentProvider(provider: PaymentProvider): Promise<PaymentProviderConfig | null> {
  const r = await query<PaymentProviderConfig>(
    `SELECT * FROM payment_provider_config WHERE provider = $1`,
    [provider]
  );
  return r.rows[0] ?? null;
}

export async function upsertPaymentProvider(
  provider: PaymentProvider,
  patch: Partial<PaymentProviderConfig>
): Promise<void> {
  const cols: string[] = [];
  const vals: unknown[] = [];
  const allowed = [
    "active", "mp_access_token", "mp_public_key", "mp_webhook_secret",
    "stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret",
    "mode", "currency", "installments_min", "installments_max", "notes"
  ];
  let i = 1;
  for (const k of allowed) {
    if (k in patch && (patch as Record<string, unknown>)[k] !== undefined) {
      cols.push(`${k} = $${i}`);
      vals.push((patch as Record<string, unknown>)[k]);
      i++;
    }
  }
  if (cols.length === 0) return;
  cols.push(`updated_at = NOW()`);
  vals.push(provider);
  await query(
    `UPDATE payment_provider_config SET ${cols.join(", ")} WHERE provider = $${i}`,
    vals
  );
}

// ──────────────────────────────────────────────────────────────
// Estadísticas
// ──────────────────────────────────────────────────────────────

export type TopFragranceRow = {
  fragrance_id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  artistic_name: string | null;
  display_code: string | null;
  family: string | null;
  image_url: string | null;
  image_version: number | null;
  units_sold: number;
  revenue_cents: number;
  order_count: number;
};

export async function topSoldFragrances(limit = 10): Promise<TopFragranceRow[]> {
  const r = await query<TopFragranceRow>(
    `SELECT f.id AS fragrance_id, f.slug, f.brand, f.name, f.full_name,
            f.artistic_name, f.display_code, f.family,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            COALESCE(SUM(oi.qty), 0)::int AS units_sold,
            COALESCE(SUM(oi.line_total_cents), 0)::int AS revenue_cents,
            COUNT(DISTINCT o.id)::int AS order_count
     FROM order_item oi
     JOIN "order" o ON o.id = oi.order_id
     JOIN fragrance f ON f.id = oi.fragrance_id
     WHERE o.status IN ('approved','in_transit','delivered')
     GROUP BY f.id, f.slug, f.brand, f.name, f.full_name, f.artistic_name, f.display_code, f.family, f.image_data, f.image_url
     ORDER BY units_sold DESC, revenue_cents DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export type TopSearchedRow = {
  fragrance_id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  artistic_name: string | null;
  display_code: string | null;
  family: string | null;
  image_url: string | null;
  image_version: number | null;
  searches: number;
  clicks: number;
};

export async function topSearchedFragrances(limit = 10, sinceDays = 30): Promise<TopSearchedRow[]> {
  const r = await query<TopSearchedRow>(
    `SELECT f.id AS fragrance_id, f.slug, f.brand, f.name, f.full_name,
            f.artistic_name, f.display_code, f.family,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            COUNT(*)::int AS searches,
            COUNT(*) FILTER (WHERE sl.clicked_slug IS NOT NULL)::int AS clicks
     FROM search_log sl
     JOIN fragrance f ON f.slug = sl.clicked_slug
     WHERE sl.created_at > NOW() - ($2 || ' days')::interval
     GROUP BY f.id, f.slug, f.brand, f.name, f.full_name, f.artistic_name, f.display_code, f.family, f.image_data, f.image_url
     ORDER BY clicks DESC, searches DESC
     LIMIT $1`,
    [limit, String(sinceDays)]
  );
  return r.rows;
}

export type TopRecommendedRow = {
  fragrance_id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  artistic_name: string | null;
  display_code: string | null;
  family: string | null;
  image_url: string | null;
  image_version: number | null;
  recommendations: number;
  clicks: number;
};

export async function topRecommendedFragrances(limit = 10, sinceDays = 30): Promise<TopRecommendedRow[]> {
  // Por cada fragancia recomendada en recommendation_log contamos 1
  // aparición. Desnormalizamos unnest(recommended_slugs).
  const r = await query<TopRecommendedRow>(
    `SELECT f.id AS fragrance_id, f.slug, f.brand, f.name, f.full_name,
            f.artistic_name, f.display_code, f.family,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            COUNT(*)::int AS recommendations,
            COUNT(*) FILTER (WHERE rl.clicked_slug = f.slug)::int AS clicks
     FROM recommendation_log rl,
          unnest(rl.recommended_slugs) AS rec_slug
     JOIN fragrance f ON f.slug = rec_slug
     WHERE rl.created_at > NOW() - ($2 || ' days')::interval
     GROUP BY f.id, f.slug, f.brand, f.name, f.full_name, f.artistic_name, f.display_code, f.family, f.image_data, f.image_url
     ORDER BY recommendations DESC, clicks DESC
     LIMIT $1`,
    [limit, String(sinceDays)]
  );
  return r.rows;
}

export type SalesKpis = {
  total_orders: number;
  approved_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  revenue_cents: number;
  avg_ticket_cents: number;
  units_sold: number;
  last_30_days_orders: number;
  last_30_days_revenue_cents: number;
};

export async function getSalesKpis(): Promise<SalesKpis> {
  const r = await query<{
    total_orders: string;
    approved_orders: string;
    pending_orders: string;
    cancelled_orders: string;
    revenue_cents: string;
    units_sold: string;
    last_30_orders: string;
    last_30_revenue: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_orders,
       COUNT(*) FILTER (WHERE status IN ('approved','in_transit','delivered'))::text AS approved_orders,
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending_orders,
       COUNT(*) FILTER (WHERE status IN ('cancelled','rejected','refunded'))::text AS cancelled_orders,
       COALESCE(SUM(total_cents) FILTER (WHERE status IN ('approved','in_transit','delivered')), 0)::text AS revenue_cents,
       COALESCE((SELECT SUM(qty) FROM order_item oi JOIN "order" o ON o.id = oi.order_id
                 WHERE o.status IN ('approved','in_transit','delivered')), 0)::text AS units_sold,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::text AS last_30_orders,
       COALESCE(SUM(total_cents) FILTER (WHERE status IN ('approved','in_transit','delivered')
                                          AND created_at > NOW() - INTERVAL '30 days'), 0)::text AS last_30_revenue
     FROM "order"`
  );
  const row = r.rows[0] ?? {};
  const revenue = Number(row.revenue_cents ?? 0);
  const approved = Number(row.approved_orders ?? 0);
  return {
    total_orders: Number(row.total_orders ?? 0),
    approved_orders: approved,
    pending_orders: Number(row.pending_orders ?? 0),
    cancelled_orders: Number(row.cancelled_orders ?? 0),
    revenue_cents: revenue,
    avg_ticket_cents: approved > 0 ? Math.round(revenue / approved) : 0,
    units_sold: Number(row.units_sold ?? 0),
    last_30_days_orders: Number(row.last_30_orders ?? 0),
    last_30_days_revenue_cents: Number(row.last_30_revenue ?? 0)
  };
}

export type SalesPoint = { day: string; revenue_cents: number; orders: number };

export async function salesTimeseries(days = 30): Promise<SalesPoint[]> {
  const r = await query<SalesPoint>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(total_cents) FILTER (WHERE status IN ('approved','in_transit','delivered')), 0)::int AS revenue_cents,
            COUNT(*)::int AS orders
     FROM "order"
     WHERE created_at > NOW() - ($1 || ' days')::interval
     GROUP BY 1
     ORDER BY day`,
    [String(days)]
  );
  return r.rows;
}

// ──────────────────────────────────────────────────────────────
// Búsqueda y recomendación (instrumentación)
// ──────────────────────────────────────────────────────────────

export async function logSearch(opts: {
  query: string;
  note?: string | null;
  family?: string | null;
  gender?: string | null;
  clickedSlug?: string | null;
  resultsCount: number;
  sessionId?: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO search_log (query, note_filter, family_filter, gender_filter, clicked_slug, results_count, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.query ?? "",
        opts.note ?? null,
        opts.family ?? null,
        opts.gender ?? null,
        opts.clickedSlug ?? null,
        opts.resultsCount ?? 0,
        opts.sessionId ?? null
      ]
    );
  } catch {
    /* no bloquear el flujo si falla el log */
  }
}

export async function logRecommendation(opts: {
  vectorJson?: Record<string, number> | null;
  setId?: string | null;
  referenceSlug?: string | null;
  gender?: string | null;
  countRequested?: number | null;
  recommendedSlugs: string[];
  sessionId?: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO recommendation_log (vector_json, set_id, reference_slug, gender_filter, count_requested, recommended_slugs, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.vectorJson ? JSON.stringify(opts.vectorJson) : null,
        opts.setId ?? null,
        opts.referenceSlug ?? null,
        opts.gender ?? null,
        opts.countRequested ?? null,
        opts.recommendedSlugs,
        opts.sessionId ?? null
      ]
    );
  } catch {
    /* no bloquear */
  }
}

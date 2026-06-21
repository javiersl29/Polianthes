import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  in_transit: "En tránsito",
  delivered: "Entregado"
};

function money(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export default async function CustomerOrderPage({ params }: { params: { id: string } }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?redirect=/cuenta");

  const orderId = Number(params.id);
  if (!Number.isFinite(orderId)) notFound();

  // Asegurar que el pedido pertenece al cliente
  const orderRes = await query<{
    id: number; public_id: string; status: string;
    subtotal_cents: number; discount_cents: number; shipping_cents: number;
    total_cents: number; currency: string; created_at: string; paid_at: string | null;
    shipping_address_line: string; shipping_address_line2: string | null;
    shipping_city: string; shipping_state: string; shipping_postal_code: string;
    shipping_zone_name: string; tracking_number: string | null; carrier: string | null;
    status_history: Array<{ status: string; at: string; note?: string }>;
  }>(
    `SELECT o.id, o.public_id, o.status, o.subtotal_cents, o.discount_cents, o.shipping_cents,
            o.total_cents, o.currency, o.created_at, o.paid_at,
            o.shipping_address_line, o.shipping_address_line2, o.shipping_city, o.shipping_state,
            o.shipping_postal_code, o.shipping_zone_name, o.tracking_number, o.carrier,
            COALESCE(
              (SELECT json_agg(json_build_object('status', h->>'status', 'at', h->>'at', 'note', h->>'note'))
               FROM jsonb_array_elements(o.status_history) AS h),
              '[]'::json
            ) AS status_history
     FROM "order" o
     WHERE o.id = $1 AND o.customer_id = $2`,
    [orderId, customer.id]
  );
  if (orderRes.rows.length === 0) notFound();
  const order = orderRes.rows[0];

  const itemsRes = await query<{
    fragrance_brand: string; fragrance_name: string; size_ml: number;
    qty: number; unit_price_cents: number; line_total_cents: number;
    fragrance_image_url: string | null;
  }>(
    `SELECT fragrance_brand, fragrance_name, size_ml, qty, unit_price_cents, line_total_cents, fragrance_image_url
     FROM order_item WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  const items = itemsRes.rows;

  return (
    <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Link href="/cuenta#pedidos" className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-gold transition-colors min-h-[44px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Volver a mis pedidos
        </Link>

        <div className="mt-4 flex flex-wrap items-start gap-4 justify-between">
          <div>
            <p className="text-xs text-gold/80 uppercase tracking-[0.2em]">Pedido</p>
            <h1 className="mt-1 font-display italic text-4xl text-ink tracking-[-1px] font-mono">
              {order.public_id}
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              {new Date(order.created_at).toLocaleString("es-MX")}
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border border-gold/30 bg-gold/10 text-gold">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="liquid-glass rounded-2xl p-4 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-3">Items</h2>
              <ul className="divide-y divide-line">
                {items.map((it, i) => (
                  <li key={i} className="py-3 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-black/30 overflow-hidden shrink-0 grid place-items-center">
                      {it.fragrance_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.fragrance_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gold/40 text-xs">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">
                        {it.fragrance_brand} · {it.fragrance_name}
                      </p>
                      <p className="text-[11px] text-ink-mute">
                        {it.size_ml}ml × {it.qty}u · {money(it.unit_price_cents)}
                      </p>
                    </div>
                    <p className="text-sm text-gold shrink-0">{money(it.line_total_cents)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-line space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-ink-mute">Subtotal</span><span className="text-ink">{money(order.subtotal_cents)}</span></div>
                {order.discount_cents > 0 && (
                  <div className="flex justify-between text-emerald-300/80"><span>Descuento</span><span>−{money(order.discount_cents)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-ink-mute">Envío</span><span className="text-ink">{order.shipping_cents === 0 ? "Gratis" : money(order.shipping_cents)}</span></div>
                <div className="flex justify-between text-base font-medium pt-2 mt-2 border-t border-line">
                  <span className="text-ink">Total</span>
                  <span className="text-gold">{money(order.total_cents, order.currency)}</span>
                </div>
              </div>
            </div>

            <div className="liquid-glass rounded-2xl p-4 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-3">Envío</h2>
              <p className="text-ink text-sm">{order.shipping_address_line}</p>
              {order.shipping_address_line2 && <p className="text-ink-mute text-sm">{order.shipping_address_line2}</p>}
              <p className="text-ink-mute text-sm">
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
              </p>
              <p className="mt-2 text-[11px] text-gold/70">Zona: {order.shipping_zone_name}</p>
              {(order.tracking_number || order.carrier) && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-[11px] uppercase tracking-wider text-gold/80">Tracking</p>
                  <p className="text-sm text-ink mt-1">
                    {order.carrier && <span>{order.carrier} · </span>}
                    <span className="font-mono">{order.tracking_number}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="liquid-glass rounded-2xl p-4 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-3">Historial</h2>
              {order.status_history.length === 0 ? (
                <p className="text-xs text-ink-mute">Sin cambios.</p>
              ) : (
                <ol className="space-y-2">
                  {[...order.status_history].reverse().map((h, i) => (
                    <li key={i} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <span className="w-2 h-2 rounded-full bg-gold mt-1"></span>
                        {i < order.status_history.length - 1 && <span className="w-px flex-1 bg-line"></span>}
                      </div>
                      <div className="pb-2">
                        <p className="text-ink font-medium">{STATUS_LABELS[h.status] ?? h.status}</p>
                        <p className="text-[11px] text-ink-mute">{new Date(h.at).toLocaleString("es-MX")}</p>
                        {h.note && <p className="text-[11px] text-ink-mute mt-0.5 italic">{h.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getAdminOrder, getOrderItems, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/admin-data";
import { genderBadge } from "@/lib/visual";
import OrderActions from "./OrderActions";
import EmailThread from "./EmailThread";

export const dynamic = "force-dynamic";

function money(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  if (!isAuthenticated()) notFound();
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const items = await getOrderItems(id);
  const history = Array.isArray(order.status_history) ? order.status_history : [];

  return (
    <div>
      <Link
        href="/admin/pedidos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-gold transition-colors min-h-[44px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Volver a pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-4 justify-between">
        <div>
          <p className="text-xs text-gold/80 uppercase tracking-[0.2em]">Pedido #{order.public_id}</p>
          <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-1px]">
            {order.customer_name}
          </h1>
          <p className="mt-1 text-sm text-ink-mute">{order.customer_email}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
          ORDER_STATUSES.find((s) => s.value === order.status)?.color ?? "border-white/10 bg-white/5 text-ink-mute"
        }`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-3">Items</h2>
            {items.length === 0 ? (
              <p className="text-sm text-ink-mute">Este pedido no tiene items.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((itRaw: unknown, i: number) => {
                  const it = itRaw as Record<string, unknown>;
                  return (
                  <li key={Number(it.id ?? i)} className="py-3 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-black/30 overflow-hidden shrink-0 grid place-items-center">
                      {typeof it.fragrance_image_url === "string" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.fragrance_image_url as string} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gold/40 text-xs">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">
                        {String(it.fragrance_brand ?? "")} · {String(it.fragrance_name ?? "")}
                      </p>
                      <p className="text-[11px] text-ink-mute">
                        {Number(it.size_ml)}ml × {Number(it.qty)}u · {money(Number(it.unit_price_cents))}
                      </p>
                    </div>
                    <p className="text-sm text-gold shrink-0">{money(Number(it.line_total_cents))}</p>
                  </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 pt-4 border-t border-line space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-ink-mute">Subtotal</span><span className="text-ink">{money(order.subtotal_cents)}</span></div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between text-emerald-300/80"><span>Descuento {order.coupon_code ? `(${order.coupon_code})` : ""}</span><span>−{money(order.discount_cents)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-ink-mute">Envío</span><span className="text-ink">{order.shipping_cents === 0 ? "Gratis" : money(order.shipping_cents)}</span></div>
              <div className="flex justify-between text-base font-medium pt-2 mt-2 border-t border-line">
                <span className="text-ink">Total</span>
                <span className="text-gold">{money(order.total_cents, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Cliente y dirección */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-3">Envío</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-mute">Destinatario</p>
                <p className="text-ink">{order.customer_name}</p>
                <p className="text-ink-mute">{order.customer_email}</p>
                {order.customer_phone && <p className="text-ink-mute">{order.customer_phone}</p>}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-mute">Dirección</p>
                <p className="text-ink">{order.shipping_address_line}</p>
                {order.shipping_address_line2 && <p className="text-ink-mute">{order.shipping_address_line2}</p>}
                <p className="text-ink-mute">{order.shipping_city}, {order.shipping_state}</p>
                <p className="text-ink-mute">{order.shipping_postal_code}, {order.shipping_country}</p>
                <p className="text-[11px] text-gold/70 mt-1">Zona: {order.shipping_zone_name}</p>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-3">Tracking</h2>
            <OrderActions
              order={{
                id: order.id,
                status: order.status,
                carrier: order.carrier ?? "",
                tracking_number: order.tracking_number ?? "",
                tracking_url: order.tracking_url ?? "",
                notes: order.notes ?? ""
              }}
              statuses={ORDER_STATUSES}
            />
          </div>

          {/* Hilo de emails */}
          <EmailThread orderId={order.id} />
        </div>

        <div className="space-y-4">
          {/* Pago */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-3">Pago</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-mute">Proveedor</dt>
                <dd className="text-ink capitalize">{order.provider ?? "—"}</dd>
              </div>
              {order.mp_payment_id && (
                <div className="flex justify-between">
                  <dt className="text-ink-mute">MP Payment ID</dt>
                  <dd className="text-ink">{order.mp_payment_id}</dd>
                </div>
              )}
              {order.stripe_payment_intent && (
                <div className="flex justify-between">
                  <dt className="text-ink-mute">Stripe PI</dt>
                  <dd className="text-ink truncate max-w-[160px]">{order.stripe_payment_intent}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-mute">Pagado</dt>
                <dd className={order.paid_at ? "text-emerald-300" : "text-ink-mute"}>
                  {order.paid_at ? new Date(order.paid_at).toLocaleString("es-MX") : "No"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Historial de estados */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-3">Historial</h2>
            {history.length === 0 ? (
              <p className="text-xs text-ink-mute">Sin cambios registrados.</p>
            ) : (
              <ol className="space-y-2">
                {[...history].reverse().map((h, i) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-gold mt-1"></span>
                      {i < history.length - 1 && <span className="w-px flex-1 bg-line"></span>}
                    </div>
                    <div className="pb-2">
                      <p className="text-ink font-medium">{ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}</p>
                      <p className="text-[11px] text-ink-mute">
                        {new Date(h.at).toLocaleString("es-MX")}
                      </p>
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
  );
}

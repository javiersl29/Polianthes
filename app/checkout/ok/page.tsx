import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type OrderRow = {
  public_id: string;
  status: string;
  customer_name: string;
  customer_email: string;
  total_cents: number;
  currency: string;
  shipping_zone_name: string;
  shipping_address_line: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  payment_method: string | null;
};

type ItemRow = {
  fragrance_brand: string;
  fragrance_name: string;
  size_ml: number;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export default async function CheckoutOkPage({ searchParams }: { searchParams: { order?: string; payment_id?: string } }) {
  const publicId = searchParams.order;

  let order: OrderRow | null = null;
  let items: ItemRow[] = [];

  if (publicId) {
    try {
      const orderRes = await query<OrderRow>(
        `SELECT public_id, status, customer_name, customer_email, total_cents, currency,
                shipping_zone_name, shipping_address_line, shipping_address_line2,
                shipping_city, shipping_state, shipping_postal_code,
                provider AS payment_method
         FROM "order" WHERE public_id = $1`,
        [publicId]
      );
      order = orderRes.rows[0] ?? null;

      if (order) {
        const itemsRes = await query<ItemRow>(
          `SELECT fragrance_brand, fragrance_name, size_ml, qty, unit_price_cents, line_total_cents
           FROM order_item oi
           JOIN "order" o ON o.id = oi.order_id
           WHERE o.public_id = $1 ORDER BY oi.id`,
          [publicId]
        );
        items = itemsRes.rows;
      }
    } catch { /* ok */ }
  }

  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header de éxito */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-400/15 border border-emerald-300/30 grid place-items-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="mt-6 font-display italic text-4xl sm:text-5xl text-ink tracking-[-1px]">¡Pago confirmado!</h1>
          <p className="mt-3 text-ink-mute">
            Recibimos tu pago y estamos preparando tu pedido. Te enviamos una confirmación por correo.
          </p>
        </div>

        {/* Detalles del pedido */}
        {order && (
          <div className="liquid-glass rounded-2xl p-5 sm:p-6 mb-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-[10px] text-gold/80 uppercase tracking-[0.2em]">Pedido</p>
                <p className="font-mono text-lg text-gold">{order.public_id}</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
                {order.status === "approved" ? "Pagado" : order.status}
              </span>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div className="border-t border-line pt-4 mb-4">
                <p className="text-[10px] text-ink-mute uppercase tracking-wider mb-2">Productos</p>
                <ul className="space-y-2">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-ink truncate">{it.fragrance_brand} · {it.fragrance_name}</p>
                        <p className="text-[11px] text-ink-mute">{it.size_ml}ml × {it.qty}u</p>
                      </div>
                      <p className="text-gold shrink-0">
                        ${(it.line_total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-line pt-4 mb-4 flex justify-between items-center">
              <span className="text-ink text-sm">Total pagado</span>
              <span className="text-gold text-xl font-medium">
                ${(order.total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} {order.currency}
              </span>
            </div>

            {/* Entrega */}
            <div className="border-t border-line pt-4">
              <p className="text-[10px] text-ink-mute uppercase tracking-wider mb-2">Entrega</p>
              <p className="text-sm text-ink">{order.customer_name}</p>
              <p className="text-xs text-ink-mute mt-0.5">{order.shipping_address_line}</p>
              {order.shipping_address_line2 && <p className="text-xs text-ink-mute">{order.shipping_address_line2}</p>}
              <p className="text-xs text-ink-mute">
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
              </p>
              <p className="text-[11px] text-gold/70 mt-1">Zona: {order.shipping_zone_name}</p>
            </div>
          </div>
        )}

        {/* Mensaje de confirmación por correo */}
        <div className="liquid-glass rounded-2xl p-4 sm:p-5 mb-6 text-center">
          <p className="text-sm text-ink/90">
            📧 Enviamos los detalles de tu pedido a
          </p>
          {order && <p className="text-sm text-gold font-medium mt-1">{order.customer_email}</p>}
          <p className="text-[11px] text-ink-mute mt-2">
            Si no recibiste el correo en 5 minutos, revisa tu carpeta de spam o contáctanos.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#catalogo"
            className="rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90 text-center"
          >
            Seguir explorando
          </Link>
          <Link
            href="/"
            className="rounded-full liquid-glass border border-line px-6 py-3 text-sm hover:border-gold/40 text-center"
          >
            Volver al inicio
          </Link>
        </div>

        {/* FAQ */}
        <div className="mt-8 text-center text-xs text-ink-mute space-y-1">
          <p>¿Dudas sobre tu pedido? Escríbenos a <span className="text-gold">ventas@polianthes.mx</span></p>
          <p className="text-[10px] opacity-60 mt-4">
            Polianthes interpreta composiciones olfativas. Las fragancias no están afiliadas
            ni respaldadas por las casas mencionadas.
          </p>
        </div>
      </div>
    </main>
  );
}

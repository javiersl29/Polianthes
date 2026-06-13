"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "in_transit" | "delivered";

type Order = {
  id: number;
  public_id: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string;
  shipping_zone_name: string;
  shipping_city: string;
  shipping_postal_code: string;
  total_cents: number;
  currency: string;
  provider: string | null;
  paid_at: string | null;
  created_at: string;
  items_count: number;
  items_qty: number;
};

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-amber-300 border-amber-300/30 bg-amber-400/10" },
  approved: { label: "Aprobado", color: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10" },
  rejected: { label: "Rechazado", color: "text-rose-300 border-rose-300/30 bg-rose-400/10" },
  cancelled: { label: "Cancelado", color: "text-ink-mute border-white/10 bg-white/5" },
  refunded: { label: "Reembolsado", color: "text-violet-300 border-violet-300/30 bg-violet-400/10" },
  in_transit: { label: "En tránsito", color: "text-sky-300 border-sky-300/30 bg-sky-400/10" },
  delivered: { label: "Entregado", color: "text-gold border-gold/30 bg-gold/10" }
};

function money(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/orders?limit=200");
      const data = await r.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.public_id.toLowerCase().includes(s) ||
        o.customer_email.toLowerCase().includes(s) ||
        o.customer_name.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div>
      <p className="text-sm text-ink-mute">// Pedidos</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Seguimiento de pedidos</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Lista de órdenes con su estado de pago y entrega. Click en una orden para ver detalle, items y tracking.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 flex-1 min-h-[44px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, email o cliente…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
              filter === "all" ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
            }`}
          >
            Todas
          </button>
          {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === s ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
              }`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 liquid-glass rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-ink-mute p-6">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-display italic text-xl text-ink">Sin pedidos todavía</p>
            <p className="mt-2 text-sm text-ink-mute">
              Los pedidos del checkout público aparecerán aquí automáticamente. También puedes crear
              órdenes manuales más adelante.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-line">
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">ID</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Cliente</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Estado</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium text-right">Total</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Pago</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/pedidos/${o.id}`} className="text-gold hover:underline">
                        {o.public_id}
                      </Link>
                      <p className="text-[11px] text-ink-mute mt-0.5">{o.items_qty}u · {o.items_count} items</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink truncate max-w-[200px]">{o.customer_name}</p>
                      <p className="text-[11px] text-ink-mute truncate max-w-[200px]">{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${STATUS_META[o.status].color}`}>
                        {STATUS_META[o.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink whitespace-nowrap">
                      {money(o.total_cents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-mute capitalize">
                      {o.provider ?? "—"}
                      {o.paid_at && <p className="text-[10px] text-emerald-300/70">Pagado</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-mute whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                      <p className="text-[10px]">{new Date(o.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

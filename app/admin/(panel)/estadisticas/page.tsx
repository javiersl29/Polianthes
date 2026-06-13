import { isAuthenticated } from "@/lib/auth";
import {
  getSalesKpis,
  salesTimeseries,
  topSoldFragrances,
  topSearchedFragrances,
  topRecommendedFragrances
} from "@/lib/admin-data";
import { genderBadge } from "@/lib/visual";
import Link from "next/link";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminStatsPage() {
  if (!isAuthenticated()) return null;

  const [kpis, timeseries, sold, searched, recommended] = await Promise.all([
    getSalesKpis(),
    salesTimeseries(30),
    topSoldFragrances(10),
    topSearchedFragrances(10, 30),
    topRecommendedFragrances(10, 30)
  ]);

  const maxRevenue = Math.max(1, ...timeseries.map((t) => t.revenue_cents));

  return (
    <div>
      <p className="text-sm text-ink-mute">// Estadísticas</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Estadísticas de ventas</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Métricas de los últimos 30 días: ingresos, pedidos, productos más vendidos, más buscados y
        más recomendados por el decoder.
      </p>

      {/* KPIs */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos (30d)" value={money(kpis.last_30_days_revenue_cents)} hint={`${money(kpis.revenue_cents)} histórico`} />
        <KpiCard label="Pedidos (30d)" value={String(kpis.last_30_days_orders)} hint={`${kpis.total_orders} histórico`} />
        <KpiCard label="Ticket promedio" value={money(kpis.avg_ticket_cents)} hint={`${kpis.approved_orders} aprobados`} />
        <KpiCard label="Unidades vendidas" value={String(kpis.units_sold)} hint={`${kpis.pending_orders} pendientes`} />
      </div>

      {/* Timeseries */}
      <div className="mt-6 liquid-glass rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display italic text-xl text-ink">Ingresos diarios (30 días)</h2>
        </div>
        {timeseries.length === 0 ? (
          <p className="text-sm text-ink-mute py-8 text-center">Sin ventas registradas todavía en este periodo.</p>
        ) : (
          <div className="flex items-end gap-px h-40 sm:h-48 overflow-x-auto">
            {timeseries.map((t) => (
              <div
                key={t.day}
                className="flex-1 min-w-[6px] group relative"
                title={`${t.day}: ${money(t.revenue_cents)} (${t.orders} pedidos)`}
              >
                <div
                  className="bg-gradient-to-t from-gold/40 to-gold rounded-t-sm transition-all hover:from-gold hover:to-gold"
                  style={{ height: `${(t.revenue_cents / maxRevenue) * 100}%`, minHeight: t.orders > 0 ? "4px" : "0" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 secciones */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankList
          title="Más vendidos"
          emoji="🏆"
          caption="Unidades vendidas en órdenes aprobadas"
          emptyText="Aún no hay ventas. Las órdenes del checkout aparecerán aquí."
          rows={sold.map((s, i) => ({
            rank: i + 1,
            slug: s.slug,
            display_code: s.display_code,
            artistic_name: s.artistic_name,
            brand: s.brand,
            name: s.name,
            family: s.family,
            image_url: s.image_url ? `${s.image_url}?v=${s.image_version ?? 0}` : null,
            value: `${s.units_sold}u`,
            sub: `${money(s.revenue_cents)} · ${s.order_count} pedidos`,
            gender: null
          }))}
        />
        <RankList
          title="Más buscados"
          emoji="🔍"
          caption={`Clicks en búsqueda (últimos 30 días)`}
          emptyText="Sin búsquedas registradas todavía. Las búsquedas del catálogo se loguean automáticamente."
          rows={searched.map((s, i) => ({
            rank: i + 1,
            slug: s.slug,
            display_code: s.display_code,
            artistic_name: s.artistic_name,
            brand: s.brand,
            name: s.name,
            family: s.family,
            image_url: s.image_url ? `${s.image_url}?v=${s.image_version ?? 0}` : null,
            value: `${s.clicks} clicks`,
            sub: `${s.searches} búsquedas`,
            gender: null
          }))}
        />
        <RankList
          title="Más recomendados"
          emoji="✨"
          caption={`Recomendaciones del decoder (últimos 30 días)`}
          emptyText="Sin recomendaciones registradas todavía. Cuando un cliente use el decoder se loguean aquí."
          rows={recommended.map((s, i) => ({
            rank: i + 1,
            slug: s.slug,
            display_code: s.display_code,
            artistic_name: s.artistic_name,
            brand: s.brand,
            name: s.name,
            family: s.family,
            image_url: s.image_url ? `${s.image_url}?v=${s.image_version ?? 0}` : null,
            value: `${s.recommendations} apariciones`,
            sub: `${s.clicks} clicks`,
            gender: null
          }))}
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="liquid-glass rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-2 font-display italic text-2xl sm:text-3xl text-gold">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-mute">{hint}</p>}
    </div>
  );
}

type RankRow = {
  rank: number;
  slug: string;
  display_code: string | null;
  artistic_name: string | null;
  brand: string;
  name: string;
  family: string | null;
  image_url: string | null;
  value: string;
  sub: string;
  gender: string | null;
};

function RankList({
  title, emoji, caption, rows, emptyText
}: {
  title: string;
  emoji: string;
  caption: string;
  rows: RankRow[];
  emptyText: string;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{emoji}</span>
        <h2 className="font-display italic text-xl text-ink">{title}</h2>
      </div>
      <p className="text-[11px] text-ink-mute mb-3">{caption}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-mute py-6 text-center">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => {
            const g = genderBadge(r.gender);
            return (
              <li key={`${r.slug}-${r.rank}`}>
                <Link
                  href={`/fragancias/${r.slug}`}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <span className="text-[11px] font-mono text-gold/70 w-4 text-center shrink-0">{r.rank}</span>
                  <div className="w-10 h-12 rounded bg-black/30 overflow-hidden shrink-0 grid place-items-center">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gold/30 text-[10px]">{r.brand[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink truncate group-hover:text-gold transition-colors">
                      {r.artistic_name ?? r.name}
                    </p>
                    <p className="text-[10px] text-ink-mute truncate">
                      {r.display_code} · {r.brand}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gold font-medium">{r.value}</p>
                    <p className="text-[10px] text-ink-mute">{r.sub}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

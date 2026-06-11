"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PricingDefault = {
  size_ml: number;
  price_cents: number;
  cost_cents: number;
  stock: number;
  sku_prefix: string;
  display_order: number;
};

type PresentationRow = {
  id: number;
  fragrance_id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  display_code: string | null;
  artistic_name: string | null;
  size_ml: number;
  price_cents: number | null;
  compare_at_price_cents: number | null;
  cost_cents: number | null;
  stock: number | null;
  sku: string | null;
  active: boolean;
};

const SIZES = [10, 30, 60, 100];

function toMxn(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return String(cents / 100);
}

function parseCents(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function PricingManager() {
  const [defaults, setDefaults] = useState<PricingDefault[]>([]);
  const [rows, setRows] = useState<PresentationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [d, p] = await Promise.all([
      fetch("/api/admin/pricing-defaults", { cache: "no-store" }),
      fetch("/api/admin/pricing", { cache: "no-store" })
    ]);
    const dj = (await d.json()) as { items: PricingDefault[] };
    const pj = (await p.json()) as { items: PresentationRow[] };
    setDefaults(dj.items ?? []);
    setRows(pj.items ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateDefault = (size_ml: number, patch: Partial<PricingDefault>) => {
    setDefaults((prev) => prev.map((d) => (d.size_ml === size_ml ? { ...d, ...patch } : d)));
  };

  const saveDefaults = async (applyToAll: boolean) => {
    setSavingDefaults(true);
    try {
      const res = await fetch("/api/admin/pricing-defaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply_to_all: applyToAll,
          updates: defaults.map((d) => ({
            size_ml: d.size_ml,
            price_mxn: d.price_cents / 100,
            cost_mxn: d.cost_cents / 100,
            stock: d.stock
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(
        applyToAll
          ? `Defaults guardados y aplicados a ${data.applied} presentaciones`
          : "Defaults guardados"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingDefaults(false);
      setApplyingAll(false);
    }
  };

  // Agrupar presentations por fragancia
  const grouped = useMemo(() => {
    const map = new Map<
      number,
      {
        fragrance_id: number;
        slug: string;
        brand: string;
        name: string;
        full_name: string;
        display_code: string | null;
        artistic_name: string | null;
        presentations: PresentationRow[];
      }
    >();
    for (const r of rows) {
      if (!map.has(r.fragrance_id)) {
        map.set(r.fragrance_id, {
          fragrance_id: r.fragrance_id,
          slug: r.slug,
          brand: r.brand,
          name: r.name,
          full_name: r.full_name,
          display_code: r.display_code,
          artistic_name: r.artistic_name,
          presentations: []
        });
      }
      map.get(r.fragrance_id)!.presentations.push(r);
    }
    let arr = Array.from(map.values());
    if (search.trim()) {
      const t = search.toLowerCase();
      arr = arr.filter(
        (g) =>
          g.full_name.toLowerCase().includes(t) ||
          g.brand.toLowerCase().includes(t) ||
          (g.artistic_name ?? "").toLowerCase().includes(t) ||
          (g.display_code ?? "").toLowerCase().includes(t)
      );
    }
    return arr;
  }, [rows, search]);

  const totalsBySize = useMemo(() => {
    const out: Record<number, { count: number; withPrice: number; minPrice: number | null; maxPrice: number | null }> = {};
    for (const s of SIZES) out[s] = { count: 0, withPrice: 0, minPrice: null, maxPrice: null };
    for (const r of rows) {
      if (!SIZES.includes(r.size_ml)) continue;
      const t = out[r.size_ml];
      t.count += 1;
      if (r.price_cents && r.price_cents > 0) {
        t.withPrice += 1;
        if (t.minPrice === null || r.price_cents < t.minPrice) t.minPrice = r.price_cents;
        if (t.maxPrice === null || r.price_cents > t.maxPrice) t.maxPrice = r.price_cents;
      }
    }
    return out;
  }, [rows]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-display italic text-2xl sm:text-3xl text-ink">Precios e inventario</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Defaults globales por tamaño. Aplican a todas las fragancias a la vez.
        </p>
      </div>

      {/* Sección A: Defaults globales */}
      <section className="liquid-glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display italic text-lg sm:text-xl text-ink">Defaults globales</h2>
            <p className="text-xs text-ink-mute mt-0.5">
              Define precio, costo y stock para cada tamaño. Se aplican a las 146 fragancias.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => saveDefaults(false)}
              disabled={savingDefaults || loading}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-ink hover:text-gold transition-colors disabled:opacity-50"
            >
              {savingDefaults && !applyingAll ? "Guardando…" : "Guardar defaults"}
            </button>
            <button
              onClick={() => {
                if (confirm("¿Aplicar estos precios a TODAS las fragancias? Sobrescribirá precios y stock en 584 presentaciones.")) {
                  setApplyingAll(true);
                  saveDefaults(true);
                }
              }}
              disabled={savingDefaults || loading}
              className="liquid-glass-strong rounded-full px-4 py-2 text-sm text-ink hover:text-gold transition-colors disabled:opacity-50"
            >
              {applyingAll ? "Aplicando…" : "Guardar y aplicar a todas"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink-mute">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {defaults.map((d) => (
              <div key={d.size_ml} className="rounded-xl bg-bg-elev/40 border border-line/30 p-3 sm:p-4 space-y-2">
                <p className="text-sm font-medium text-ink">{d.size_ml} ml</p>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-mute">Precio público</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-mute">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={toMxn(d.price_cents)}
                      onChange={(e) => {
                        const c = parseCents(e.target.value);
                        if (c !== null) updateDefault(d.size_ml, { price_cents: c });
                      }}
                      className="w-full bg-bg-elev/60 rounded-md pl-5 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-mute">Costo unitario</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-mute">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={toMxn(d.cost_cents)}
                      onChange={(e) => {
                        const c = parseCents(e.target.value);
                        if (c !== null) updateDefault(d.size_ml, { cost_cents: c });
                      }}
                      className="w-full bg-bg-elev/60 rounded-md pl-5 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-mute">Stock global</label>
                  <input
                    type="number"
                    value={d.stock}
                    onChange={(e) => updateDefault(d.size_ml, { stock: Math.max(-1, Number(e.target.value)) })}
                    className="w-full bg-bg-elev/60 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
                <p className="text-[10px] text-ink-mute pt-1">
                  SKU: {d.sku_prefix}-NNN-{d.size_ml}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sección B: Vista del catálogo */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display italic text-lg sm:text-xl text-ink">Estado del catálogo</h2>
            <p className="text-xs text-ink-mute mt-0.5">
              {grouped.length} fragancias · {rows.length} presentaciones
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, marca, código…"
            className="liquid-glass rounded-full px-3 sm:px-4 py-2 text-sm bg-transparent outline-none placeholder:text-ink-mute w-full sm:w-72"
          />
        </div>

        {/* Resumen por tamaño */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {SIZES.map((s) => {
            const t = totalsBySize[s];
            return (
              <div key={s} className="liquid-glass rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-mute">{s} ml</p>
                <p className="mt-1 text-sm text-ink">
                  <span className="text-gold font-medium">{t.withPrice}</span>
                  <span className="text-ink-mute"> / {t.count}</span> con precio
                </p>
                {t.minPrice !== null && (
                  <p className="text-[10px] text-ink-mute mt-0.5">
                    ${(t.minPrice / 100).toFixed(0)} – ${(t.maxPrice! / 100).toFixed(0)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Lista de fragancias */}
        <div className="space-y-2">
          {grouped.slice(0, 50).map((g) => (
            <div key={g.fragrance_id} className="liquid-glass rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gold/80 uppercase tracking-wider">{g.display_code ?? `PLT-${String(g.fragrance_id).padStart(3, "0")}`}</p>
                <p className="font-display italic text-base sm:text-lg text-ink leading-tight truncate">
                  {g.artistic_name ?? `Polianthes ${String(g.fragrance_id).padStart(3, "0")}`}
                </p>
                <p className="text-[11px] text-ink-mute truncate">
                  {g.brand} · {g.name}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.presentations
                  .sort((a, b) => a.size_ml - b.size_ml)
                  .map((p) => (
                    <span
                      key={p.id}
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        p.price_cents && p.price_cents > 0
                          ? "border-gold/30 text-ink/90"
                          : "border-line/40 text-ink-mute/60"
                      }`}
                      title={p.sku ?? ""}
                    >
                      {p.size_ml}ml
                      {p.price_cents && p.price_cents > 0
                        ? ` · $${(p.price_cents / 100).toFixed(0)}`
                        : " · s/precio"}
                    </span>
                  ))}
              </div>
            </div>
          ))}
          {grouped.length > 50 && (
            <p className="text-center text-xs text-ink-mute py-2">
              Mostrando 50 de {grouped.length}. Refina la búsqueda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

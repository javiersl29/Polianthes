"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PresentationRow = {
  id: number;
  fragrance_id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  size_ml: number;
  price_cents: number | null;
  compare_at_price_cents: number | null;
  stock: number | null;
  sku: string | null;
  weight_grams: number | null;
  active: boolean;
};

type Editable = {
  priceMxn: string;
  compareMxn: string;
  stock: string;
  sku: string;
  active: boolean;
};

const SIZES = [10, 30, 60, 100];

function emptyEditable(): Editable {
  return { priceMxn: "", compareMxn: "", stock: "", sku: "", active: true };
}

function toEditable(p: PresentationRow): Editable {
  return {
    priceMxn: p.price_cents === null || p.price_cents === undefined ? "" : String(p.price_cents / 100),
    compareMxn: p.compare_at_price_cents === null || p.compare_at_price_cents === undefined ? "" : String(p.compare_at_price_cents / 100),
    stock: p.stock === null || p.stock === undefined ? "" : String(p.stock),
    sku: p.sku ?? "",
    active: p.active
  };
}

function toCents(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function toStock(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (trimmed === "-1") return -1;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < -1) return null;
  return Math.round(n);
}

function diffEdits(original: PresentationRow, current: Editable): Partial<PresentationRow> | null {
  const out: Partial<PresentationRow> = {};
  const origCents = original.price_cents ?? null;
  const newCents = toCents(current.priceMxn);
  if (origCents !== newCents) out.price_cents = newCents;
  const origCompare = original.compare_at_price_cents ?? null;
  const newCompare = toCents(current.compareMxn);
  if (origCompare !== newCompare) out.compare_at_price_cents = newCompare;
  const origStock = original.stock ?? null;
  const newStock = toStock(current.stock);
  if (origStock !== newStock) out.stock = newStock;
  const origSku = original.sku ?? "";
  if (origSku !== current.sku.trim()) out.sku = current.sku.trim() || null;
  if (original.active !== current.active) out.active = current.active;
  return Object.keys(out).length === 0 ? null : out;
}

export default function PricingManager() {
  const [rows, setRows] = useState<PresentationRow[]>([]);
  const [edits, setEdits] = useState<Record<number, Editable>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { items: PresentationRow[] }) => {
        setRows(data.items ?? []);
        const map: Record<number, Editable> = {};
        for (const r of data.items ?? []) map[r.id] = toEditable(r);
        setEdits(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const t = search.toLowerCase();
    return rows.filter((r) =>
      r.full_name.toLowerCase().includes(t) || r.brand.toLowerCase().includes(t)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { brand: string; name: string; slug: string; items: PresentationRow[] }>();
    for (const r of filtered) {
      const key = r.slug;
      if (!map.has(key)) {
        map.set(key, { brand: r.brand, name: r.name, slug: r.slug, items: [] });
      }
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values());
  }, [filtered]);

  const pendingCount = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      const e = edits[r.id];
      if (!e) continue;
      if (diffEdits(r, e)) n += 1;
    }
    return n;
  }, [rows, edits]);

  const update = (id: number, patch: Partial<Editable>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyEditable()), ...patch } }));
  };

  const saveAll = async () => {
    const updates: Array<{ id: number } & Record<string, unknown>> = [];
    for (const r of rows) {
      const e = edits[r.id];
      if (!e) continue;
      const d = diffEdits(r, e);
      if (!d) continue;
      updates.push({ id: r.id, ...d });
    }
    if (updates.length === 0) {
      toast.info("Sin cambios pendientes");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(`${data.updated} presentación(es) actualizadas`);
      const reload = await fetch("/api/admin/pricing", { cache: "no-store" });
      const json = (await reload.json()) as { items: PresentationRow[] };
      setRows(json.items);
      const map: Record<number, Editable> = {};
      for (const r of json.items) map[r.id] = toEditable(r);
      setEdits(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display italic text-2xl sm:text-3xl text-ink">Precios e inventario</h1>
          <p className="mt-1 text-sm text-ink-mute">
            Define el precio y stock de cada presentación. Los cambios se guardan todos a la vez.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fragancia…"
            className="liquid-glass rounded-full px-3 sm:px-4 py-2 text-sm bg-transparent outline-none placeholder:text-ink-mute w-full sm:w-64"
          />
          <button
            onClick={saveAll}
            disabled={saving || loading}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm text-ink hover:text-gold transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? "Guardando…" : pendingCount > 0 ? `Guardar (${pendingCount})` : "Guardar"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-mute">Cargando…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-ink-mute">Sin fragancias.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => {
            const bySize = new Map(g.items.map((it) => [it.size_ml, it]));
            return (
              <div key={g.slug} className="liquid-glass rounded-2xl p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                  <div>
                    <p className="text-[10px] text-ink-mute uppercase tracking-wider">{g.brand}</p>
                    <p className="font-display italic text-lg sm:text-xl text-ink leading-tight">{g.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {SIZES.map((size) => {
                    const row = bySize.get(size);
                    if (!row) {
                      return (
                        <div key={size} className="rounded-xl border border-dashed border-line p-3 text-center text-[11px] text-ink-mute">
                          {size} ml — sin presentación
                        </div>
                      );
                    }
                    const e = edits[row.id] ?? emptyEditable();
                    const dirty = diffEdits(row, e) !== null;
                    return (
                      <div key={row.id} className={`rounded-xl p-2.5 sm:p-3 bg-bg-elev/40 border ${dirty ? "border-gold/60" : "border-transparent"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] uppercase tracking-wider text-ink-mute">{size} ml</p>
                          <label className="flex items-center gap-1 text-[10px] text-ink-mute cursor-pointer">
                            <input
                              type="checkbox"
                              checked={e.active}
                              onChange={(ev) => update(row.id, { active: ev.target.checked })}
                              className="h-3 w-3 accent-[color:var(--color-gold)]"
                            />
                            activo
                          </label>
                        </div>
                        <div className="space-y-1.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-mute">$</span>
                            <input
                              value={e.priceMxn}
                              onChange={(ev) => update(row.id, { priceMxn: ev.target.value })}
                              placeholder="0"
                              inputMode="decimal"
                              className="w-full bg-bg-elev/60 rounded-md pl-5 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold"
                            />
                          </div>
                          <input
                            value={e.compareMxn}
                            onChange={(ev) => update(row.id, { compareMxn: ev.target.value })}
                            placeholder="Tachado (opcional)"
                            inputMode="decimal"
                            className="w-full bg-bg-elev/60 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-gold text-ink-mute"
                          />
                          <div className="flex gap-1">
                            <input
                              value={e.stock}
                              onChange={(ev) => update(row.id, { stock: ev.target.value })}
                              placeholder="Stock (-1=∞)"
                              inputMode="numeric"
                              className="w-1/2 bg-bg-elev/60 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-gold"
                            />
                            <input
                              value={e.sku}
                              onChange={(ev) => update(row.id, { sku: ev.target.value })}
                              placeholder="SKU"
                              className="w-1/2 bg-bg-elev/60 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-gold"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Zone = {
  id: number;
  name: string;
  postal_code_prefix: string;
  cost_cents: number;
  free_from_cents: number | null;
  estimated_days: string | null;
  active: boolean;
  display_order: number;
};

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

const EMPTY: Omit<Zone, "id" | "created_at"> & { id?: number } = {
  name: "",
  postal_code_prefix: "",
  cost_cents: 0,
  free_from_cents: null,
  estimated_days: "",
  active: true,
  display_order: 0
};

export default function AdminShippingPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof EMPTY | Zone | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/shipping");
      const data = await r.json();
      setZones(data.zones ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.name || !editing.postal_code_prefix) {
      toast.error("Nombre y prefijo de CP son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: editing.name,
          postal_code_prefix: editing.postal_code_prefix,
          cost_cents: Number(editing.cost_cents),
          free_from_cents: editing.free_from_cents ? Number(editing.free_from_cents) : null,
          estimated_days: editing.estimated_days,
          active: editing.active,
          display_order: Number(editing.display_order ?? 0)
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(editing.id ? "Zona actualizada" : "Zona creada");
      setEditing(null);
      setZones(data.zones ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar esta zona de envío?")) return;
    try {
      const r = await fetch(`/api/admin/shipping?id=${id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Zona eliminada");
      setZones(data.zones ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-mute">// Envíos</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Medios de envío</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Configura las zonas por prefijo de código postal. La primera zona que coincida con el CP del cliente
        se aplicará automáticamente en el checkout.
      </p>

      <div className="mt-6 flex justify-between items-center">
        <p className="text-xs text-ink-mute">{zones.length} zonas</p>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded-full bg-gold text-bg px-4 py-1.5 text-xs font-medium hover:bg-gold/90 transition-colors"
        >
          + Nueva zona
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-mute">Cargando…</p>
      ) : zones.length === 0 ? (
        <div className="mt-6 liquid-glass rounded-2xl p-6 text-center">
          <p className="font-display italic text-xl text-ink">No hay zonas configuradas</p>
          <p className="mt-2 text-sm text-ink-mute">Crea tu primera zona para habilitar el cálculo de envío.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {zones.map((z) => (
            <div key={z.id} className="liquid-glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display italic text-lg text-ink">{z.name}</p>
                  <p className="text-[11px] text-gold/80 font-mono">CP: {z.postal_code_prefix}*</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                  z.active ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                           : "border-white/10 bg-white/5 text-ink-mute"
                }`}>
                  {z.active ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="mt-3 text-sm space-y-0.5">
                <p className="text-ink">{money(z.cost_cents)}</p>
                {z.free_from_cents && (
                  <p className="text-[11px] text-emerald-300/70">Gratis desde {money(z.free_from_cents)}</p>
                )}
                {z.estimated_days && (
                  <p className="text-[11px] text-ink-mute">Entrega: {z.estimated_days}</p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(z)}
                  className="liquid-glass rounded-full px-3 py-1 text-xs hover:text-gold transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(z.id)}
                  className="rounded-full px-3 py-1 text-xs text-rose-300 border border-rose-300/30 hover:bg-rose-400/10 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="liquid-glass rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display italic text-2xl text-ink mb-4">
              {editing.id ? "Editar zona" : "Nueva zona"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gold/80">Nombre</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="CDMX Centro"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gold/80">Prefijo CP</label>
                  <input
                    value={editing.postal_code_prefix}
                    onChange={(e) => setEditing({ ...editing, postal_code_prefix: e.target.value })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                    placeholder="01,02,03…"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gold/80">Costo (cents)</label>
                  <input
                    type="number"
                    value={editing.cost_cents}
                    onChange={(e) => setEditing({ ...editing, cost_cents: Number(e.target.value) })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    placeholder="9000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gold/80">Gratis desde (cents)</label>
                  <input
                    type="number"
                    value={editing.free_from_cents ?? ""}
                    onChange={(e) => setEditing({ ...editing, free_from_cents: e.target.value ? Number(e.target.value) : null })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gold/80">Orden</label>
                  <input
                    type="number"
                    value={editing.display_order}
                    onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-gold/80">T. estimado</label>
                <input
                  value={editing.estimated_days ?? ""}
                  onChange={(e) => setEditing({ ...editing, estimated_days: e.target.value })}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="2-4 días hábiles"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="accent-[color:var(--color-gold)]"
                />
                Zona activa
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full px-4 py-2 text-sm text-ink-mute hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

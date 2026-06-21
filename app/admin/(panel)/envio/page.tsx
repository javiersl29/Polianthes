"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/money";
import ShippingGeneralConfig from "./ShippingGeneralConfig";

type Kind = "shipping" | "pickup";

type Tab = Kind | "general";

type Zone = {
  id: number;
  name: string;
  kind: Kind;
  postal_code_prefix: string;
  cost_cents: number;
  free_from_cents: number | null;
  estimated_days: string | null;
  active: boolean;
  display_order: number;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_schedule: string | null;
  phone: string | null;
  email: string | null;
};

type Editing = {
  id?: number;
  name: string;
  kind: Kind;
  postal_code_prefix: string;
  cost: string;
  free_from: string;
  estimated_days: string;
  active: boolean;
  display_order: number;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_postal_code: string;
  pickup_schedule: string;
  phone: string;
  email: string;
};

const EMPTY: Editing = {
  name: "",
  kind: "shipping",
  postal_code_prefix: "",
  cost: "",
  free_from: "",
  estimated_days: "",
  active: true,
  display_order: 0,
  pickup_address: "",
  pickup_city: "",
  pickup_state: "",
  pickup_postal_code: "",
  pickup_schedule: "",
  phone: "",
  email: ""
};

function toEditing(z: Zone): Editing {
  return {
    id: z.id,
    name: z.name,
    kind: z.kind,
    postal_code_prefix: z.postal_code_prefix ?? "",
    cost: z.cost_cents ? (z.cost_cents / 100).toString() : "",
    free_from: z.free_from_cents ? (z.free_from_cents / 100).toString() : "",
    estimated_days: z.estimated_days ?? "",
    active: z.active,
    display_order: z.display_order,
    pickup_address: z.pickup_address ?? "",
    pickup_city: z.pickup_city ?? "",
    pickup_state: z.pickup_state ?? "",
    pickup_postal_code: z.pickup_postal_code ?? "",
    pickup_schedule: z.pickup_schedule ?? "",
    phone: z.phone ?? "",
    email: z.email ?? ""
  };
}

export default function AdminShippingPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("shipping");

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
    if (!editing.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (editing.kind === "shipping" && !editing.postal_code_prefix.trim()) {
      toast.error("El prefijo de CP es obligatorio para zonas de envío");
      return;
    }
    if (editing.kind === "pickup" && !editing.pickup_address.trim()) {
      toast.error("La dirección del sitio es obligatoria");
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
          kind: editing.kind,
          postal_code_prefix: editing.postal_code_prefix,
          cost: editing.cost,
          free_from: editing.free_from,
          estimated_days: editing.estimated_days,
          active: editing.active,
          display_order: editing.display_order,
          pickup_address: editing.pickup_address,
          pickup_city: editing.pickup_city,
          pickup_state: editing.pickup_state,
          pickup_postal_code: editing.pickup_postal_code,
          pickup_schedule: editing.pickup_schedule,
          phone: editing.phone,
          email: editing.email
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(editing.id ? "Actualizado" : "Creado");
      setEditing(null);
      setZones(data.zones ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const r = await fetch(`/api/admin/shipping?id=${id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Eliminado");
      setZones(data.zones ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  const visibleZones = zones.filter((z) => z.kind === tab);

  return (
    <div>
      <p className="text-sm text-ink-mute">// Envíos y entregas</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Logística</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Gestiona las zonas de envío a domicilio (por código postal) y los sitios de entrega física
        donde los clientes pueden recoger sus pedidos sin costo.
      </p>

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("shipping")}
          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
            tab === "shipping" ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
          }`}
        >
          🚚 Envío a domicilio ({zones.filter((z) => z.kind === "shipping").length})
        </button>
        <button
          onClick={() => setTab("pickup")}
          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
            tab === "pickup" ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
          }`}
        >
          🏬 Entrega física ({zones.filter((z) => z.kind === "pickup").length})
        </button>
        <button
          onClick={() => setTab("general")}
          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
            tab === "general" ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
          }`}
        >
          ⚙️ Configuración general
        </button>
        <div className="flex-1" />
        {tab !== "general" && (
          <button
            onClick={() => setEditing({ ...EMPTY, kind: tab })}
            className="rounded-full bg-gold text-bg px-4 py-2 text-xs font-medium hover:bg-gold/90"
          >
            + Nuevo {tab === "shipping" ? "zona" : "sitio"}
          </button>
        )}
      </div>

      {/* Tab "General": configuración global (override + default) */}
      {tab === "general" ? (
        <ShippingGeneralConfig />
      ) : (
      <>
      {/* Listado */}
      {loading ? (
        <p className="mt-6 text-sm text-ink-mute">Cargando…</p>
      ) : visibleZones.length === 0 ? (
        <div className="mt-6 liquid-glass rounded-2xl p-6 text-center">
          <p className="font-display italic text-xl text-ink">
            {tab === "shipping" ? "Sin zonas de envío" : "Sin sitios de entrega"}
          </p>
          <p className="mt-2 text-sm text-ink-mute">
            {tab === "shipping"
              ? "Crea tu primera zona por código postal para calcular el costo de envío."
              : "Añade una dirección donde los clientes puedan recoger sus pedidos."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleZones.map((z) => (
            <div key={z.id} className="liquid-glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display italic text-lg text-ink truncate">{z.name}</p>
                  {z.kind === "shipping" ? (
                    <p className="text-[11px] text-gold/80 font-mono">CP: {z.postal_code_prefix}*</p>
                  ) : (
                    <p className="text-[11px] text-gold/80">🏬 Sitio de entrega</p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                  z.active ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                           : "border-white/10 bg-white/5 text-ink-mute"
                }`}>
                  {z.active ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="mt-3 text-sm space-y-0.5">
                {z.kind === "shipping" ? (
                  <>
                    <p className="text-ink">{formatMXN(z.cost_cents)}</p>
                    {z.free_from_cents && (
                      <p className="text-[11px] text-emerald-300/70">Gratis desde {formatMXN(z.free_from_cents)}</p>
                    )}
                    {z.estimated_days && (
                      <p className="text-[11px] text-ink-mute">Entrega: {z.estimated_days}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-ink">{z.pickup_address}</p>
                    <p className="text-[11px] text-ink-mute">
                      {z.pickup_city}{z.pickup_city && z.pickup_state ? ", " : ""}{z.pickup_state} {z.pickup_postal_code}
                    </p>
                    {z.pickup_schedule && (
                      <p className="text-[11px] text-gold/70">🕘 {z.pickup_schedule}</p>
                    )}
                    {z.phone && <p className="text-[11px] text-ink-mute">📞 {z.phone}</p>}
                    {z.email && <p className="text-[11px] text-ink-mute">✉ {z.email}</p>}
                    <p className="text-[11px] text-emerald-300/70 mt-1">Gratis (recogida en sitio)</p>
                  </>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(toEditing(z))}
                  className="liquid-glass rounded-full px-3 py-1 text-xs hover:text-gold transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(z.id, z.name)}
                  className="rounded-full px-3 py-1 text-xs text-rose-300 border border-rose-300/30 hover:bg-rose-400/10 transition-colors"
                >
                   Eliminar
                 </button>
               </div>
             </div>
           ))}
         </div>
       )}
      </>
      )}

      {/* Modal edición */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="liquid-glass rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="shrink-0 p-6 pb-3">
              <h3 className="font-display italic text-2xl text-ink mb-1">
                {editing.id ? "Editar" : "Nuevo"} {editing.kind === "shipping" ? "zona de envío" : "sitio de entrega"}
              </h3>
              <p className="text-xs text-ink-mute">
                {editing.kind === "shipping"
                  ? "Configura el costo de envío por prefijo de código postal."
                  : "Dirección donde el cliente puede recoger su pedido sin costo de envío."}
              </p>

              {/* Toggle tipo */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, kind: "shipping" })}
                  className={`rounded-xl px-3 py-2.5 text-sm border transition-colors ${
                    editing.kind === "shipping"
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line/40 text-ink/60 hover:text-ink"
                  }`}
                >
                  🚚 Envío a domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, kind: "pickup" })}
                  className={`rounded-xl px-3 py-2.5 text-sm border transition-colors ${
                    editing.kind === "pickup"
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line/40 text-ink/60 hover:text-ink"
                  }`}
                >
                  🏬 Entrega física
                </button>
              </div>
            </div>

            {/* Body con scroll independiente */}
            <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
              <div className="space-y-3">
                {/* Nombre (ambos) */}
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-gold/80">Nombre *</span>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    placeholder={editing.kind === "shipping" ? "CDMX Centro" : "Polianthes Polanco"}
                    required
                  />
                </label>

                {/* Campos exclusivos de shipping */}
                {editing.kind === "shipping" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Prefijo CP *</span>
                        <input
                          value={editing.postal_code_prefix}
                          onChange={(e) => setEditing({ ...editing, postal_code_prefix: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                          placeholder="01,02,03…"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Costo (MXN)</span>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editing.cost}
                            onChange={(e) => setEditing({ ...editing, cost: e.target.value })}
                            className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                            placeholder="99.50"
                          />
                        </div>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Gratis desde (MXN)</span>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editing.free_from}
                            onChange={(e) => setEditing({ ...editing, free_from: e.target.value })}
                            className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                            placeholder="1500.00"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Orden</span>
                        <input
                          type="number"
                          value={editing.display_order}
                          onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-gold/80">Tiempo estimado</span>
                      <input
                        value={editing.estimated_days}
                        onChange={(e) => setEditing({ ...editing, estimated_days: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                        placeholder="2-4 días hábiles"
                      />
                    </label>
                  </>
                )}

                {/* Campos exclusivos de pickup */}
                {editing.kind === "pickup" && (
                  <>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-gold/80">Dirección *</span>
                      <input
                        value={editing.pickup_address}
                        onChange={(e) => setEditing({ ...editing, pickup_address: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                        placeholder="Av. Presidente Masaryk 123"
                        required
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Ciudad</span>
                        <input
                          value={editing.pickup_city}
                          onChange={(e) => setEditing({ ...editing, pickup_city: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                          placeholder="CDMX"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Estado</span>
                        <input
                          value={editing.pickup_state}
                          onChange={(e) => setEditing({ ...editing, pickup_state: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                          placeholder="Ciudad de México"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">CP</span>
                        <input
                          value={editing.pickup_postal_code}
                          onChange={(e) => setEditing({ ...editing, pickup_postal_code: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                          placeholder="11550"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Orden</span>
                        <input
                          type="number"
                          value={editing.display_order}
                          onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-gold/80">Horario</span>
                      <input
                        value={editing.pickup_schedule}
                        onChange={(e) => setEditing({ ...editing, pickup_schedule: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                        placeholder="Lun-Vie 11:00-19:00, Sáb 11:00-15:00"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Teléfono</span>
                        <input
                          value={editing.phone}
                          onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                          placeholder="55 1234 5678"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Email</span>
                        <input
                          type="email"
                          value={editing.email}
                          onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                          className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                          placeholder="polanco@polianthes.mx"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer fijo: SIEMPRE visible con los botones */}
            <div className="shrink-0 p-6 pt-3 border-t border-line">
              <label className="flex items-center gap-2 text-sm text-ink mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="accent-[color:var(--color-gold)]"
                />
                Activo (visible en el checkout)
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-full bg-gold text-bg px-4 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full px-4 py-2.5 text-sm text-ink-mute hover:text-ink"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

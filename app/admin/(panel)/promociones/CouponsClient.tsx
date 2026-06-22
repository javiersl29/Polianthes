"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Coupon = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  active: boolean;
  description: string | null;
  created_at: string;
};

type CouponForm = {
  id?: number;
  code: string;
  type: "percent" | "fixed";
  value: string;
  min_subtotal: string;
  expires_at: string;
  usage_limit: string;
  description: string;
  active: boolean;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  type: "percent",
  value: "",
  min_subtotal: "",
  expires_at: "",
  usage_limit: "",
  description: "",
  active: true
};

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "POL-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function CouponsClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CouponForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/coupons");
      const data = await r.json();
      setCoupons(data.coupons ?? []);
    } catch {
      toast.error("Error al cargar cupones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...EMPTY_FORM, code: generateCode() });
  }

  function openEdit(c: Coupon) {
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: (c.value / 100).toString(),
      min_subtotal: c.min_subtotal_cents ? (c.min_subtotal_cents / 100).toString() : "",
      expires_at: c.expires_at ? c.expires_at.substring(0, 10) : "",
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      description: c.description ?? "",
      active: c.active
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          code: form.code.toUpperCase().trim(),
          type: form.type,
          value: form.type === "percent"
            ? Number(form.value) // % directo
            : Math.round(Number(form.value) * 100), // MXN → centavos
          min_subtotal_cents: form.min_subtotal ? Math.round(Number(form.min_subtotal) * 100) : null,
          expires_at: form.expires_at ? `${form.expires_at}T23:59:59Z` : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          description: form.description || null,
          active: form.active
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(form.id ? "Cupón actualizado" : "Cupón creado");
      setForm(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, code: string) {
    if (!confirm(`¿Eliminar el cupón "${code}"? Esta acción no se puede deshacer.`)) return;
    try {
      const r = await fetch(`/api/admin/coupons?id=${id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error ?? "Error");
      }
      toast.success("Cupón eliminado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-ink-mute">// Marketing</p>
          <h2 className="mt-1 font-display italic text-3xl sm:text-4xl text-ink tracking-[-2px]">Cupones</h2>
          <p className="mt-2 text-sm text-ink-mute max-w-2xl">
            Crea cupones de descuento configurables. El cliente los ingresa en el checkout
            y el descuento se aplica sobre el subtotal.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 transition-colors"
        >
          + Nuevo cupón
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-mute">Cargando cupones…</p>
      ) : coupons.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center text-ink-mute">
          <p>Aún no hay cupones. Crea el primero con "+ Nuevo cupón".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coupons.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const exhausted = c.usage_limit != null && c.usage_count >= c.usage_limit;
            const inactive = !c.active || expired || exhausted;
            return (
              <div
                key={c.id}
                className={`liquid-glass rounded-2xl p-4 flex flex-col gap-2 ${inactive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="font-mono text-base font-bold text-gold tracking-wider truncate">
                    {c.code}
                  </code>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                    inactive
                      ? "border-rose-300/30 bg-rose-400/10 text-rose-300"
                      : "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                  }`}>
                    {expired ? "Expirado" : exhausted ? "Agotado" : c.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="text-2xl font-display italic text-ink">
                  {c.type === "percent" ? `${c.value / 100}%` : money(c.value)}
                  <span className="text-xs text-ink-mute not-italic ml-2">de descuento</span>
                </div>
                {c.description && <p className="text-xs text-ink-mute">{c.description}</p>}
                <div className="text-[11px] text-ink-mute/80 flex flex-col gap-0.5 pt-1 border-t border-line/40">
                  <span>Mín. pedido: {money(c.min_subtotal_cents)}</span>
                  <span>Usos: {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : " (sin límite)"}</span>
                  <span>Expira: {formatDate(c.expires_at)}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="liquid-glass rounded-full px-3 py-1 text-xs hover:text-gold transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(c.id, c.code)}
                    className="rounded-full px-3 py-1 text-xs text-rose-300 border border-rose-300/30 hover:bg-rose-400/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edición */}
      {form && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setForm(null)}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="liquid-glass rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 p-6 pb-3">
              <h3 className="font-display italic text-2xl text-ink mb-1">
                {form.id ? "Editar cupón" : "Nuevo cupón"}
              </h3>
              <p className="text-xs text-ink-mute">
                El cliente ingresa el código en el checkout para aplicar el descuento.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-gold/80">Código *</span>
                      <input
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                        placeholder="POL-XXXXXX"
                        required
                        maxLength={32}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, code: generateCode() })}
                    className="self-end liquid-glass rounded-lg px-3 py-2 text-xs hover:text-gold"
                  >
                    ↻ Generar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Tipo</span>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    >
                      <option value="percent">Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">
                      {form.type === "percent" ? "Porcentaje (0-100)" : "Monto (MXN)"}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder={form.type === "percent" ? "10" : "50"}
                      required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Pedido mínimo (MXN)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.min_subtotal}
                      onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder="Sin mínimo"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Expira</span>
                    <input
                      type="date"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-gold/80">Límite de usos (opcional)</span>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    placeholder="Sin límite"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-gold/80">Descripción interna</span>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                    placeholder="Ej: Promoción Black Friday"
                  />
                </label>
              </div>
            </div>

            <div className="shrink-0 p-6 pt-3 border-t border-line">
              <label className="flex items-center gap-2 text-sm text-ink mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="accent-[color:var(--color-gold)]"
                />
                Cupón activo
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-full bg-gold text-bg px-4 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : form.id ? "Actualizar" : "Crear cupón"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
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
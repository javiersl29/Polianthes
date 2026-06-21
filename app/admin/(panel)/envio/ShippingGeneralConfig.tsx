"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatMXN, parseMXN } from "@/lib/money";

type ShippingConfig = {
  id: 1;
  default_cost_cents: number;
  default_free_from_cents: number | null;
  default_estimated_days: string | null;
  override_enabled: boolean;
  override_cost_cents: number | null;
  override_free_from_cents: number | null;
  override_estimated_days: string | null;
  override_label: string | null;
  active: boolean;
  updated_at: string;
};

const EMPTY_CONFIG: ShippingConfig = {
  id: 1,
  default_cost_cents: 0,
  default_free_from_cents: null,
  default_estimated_days: null,
  override_enabled: false,
  override_cost_cents: null,
  override_free_from_cents: null,
  override_estimated_days: null,
  override_label: null,
  active: true,
  updated_at: ""
};

export default function ShippingGeneralConfig() {
  const [config, setConfig] = useState<ShippingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Strings en MXN para inputs (evitamos errores de redondeo)
  const [defaultCost, setDefaultCost] = useState("");
  const [defaultFreeFrom, setDefaultFreeFrom] = useState("");
  const [defaultDays, setDefaultDays] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideCost, setOverrideCost] = useState("");
  const [overrideFreeFrom, setOverrideFreeFrom] = useState("");
  const [overrideDays, setOverrideDays] = useState("");
  const [overrideLabel, setOverrideLabel] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/shipping/config");
      if (!r.ok) throw new Error("Error al cargar");
      const data = await r.json();
      const c: ShippingConfig = data.config ?? EMPTY_CONFIG;
      setConfig(c);
      setDefaultCost(c.default_cost_cents > 0 ? (c.default_cost_cents / 100).toString() : "");
      setDefaultFreeFrom(c.default_free_from_cents ? (c.default_free_from_cents / 100).toString() : "");
      setDefaultDays(c.default_estimated_days ?? "");
      setOverrideEnabled(c.override_enabled);
      setOverrideCost(c.override_cost_cents != null ? (c.override_cost_cents / 100).toString() : "");
      setOverrideFreeFrom(c.override_free_from_cents != null ? (c.override_free_from_cents / 100).toString() : "");
      setOverrideDays(c.override_estimated_days ?? "");
      setOverrideLabel(c.override_label ?? "");
    } catch (e) {
      toast.error("No se pudo cargar la configuración global");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/shipping/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_cost: defaultCost,
          default_free_from: defaultFreeFrom,
          default_estimated_days: defaultDays,
          override_enabled: overrideEnabled,
          override_cost: overrideCost,
          override_free_from: overrideFreeFrom,
          override_estimated_days: overrideDays,
          override_label: overrideLabel
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setConfig(data.config);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-ink-mute">Cargando configuración global…</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Banner informativo */}
      <div className="liquid-glass rounded-2xl p-4 border-l-4 border-gold/60">
        <p className="text-sm text-ink">
          <strong>📦 Configuración general de envío.</strong> Define el costo <em>flat</em> para todo México
          cuando no hay una zona específica por código postal, o activa un <em>override global</em> que
          ignore las zonas y cobre siempre un monto fijo (útil para ofertas temporales como "envío gratis
          en todo el país").
        </p>
        <ul className="mt-2 text-xs text-ink-mute space-y-0.5 list-disc pl-5">
          <li><strong>Default</strong>: se aplica cuando no hay match de zona por CP.</li>
          <li><strong>Override</strong>: si está activo, <em>reemplaza</em> cualquier zona y cobra este costo fijo.</li>
          <li>Las promociones de tipo <code>free_shipping</code> siguen funcionando con ambas opciones.</li>
          <li>El <code>free_from_cents</code> se evalúa contra el <strong>subtotal pre-promo</strong> (precio catálogo) para evitar inconsistencias.</li>
        </ul>
      </div>

      {/* SECCIÓN 1: Costo default (fallback) */}
      <section className="liquid-glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display italic text-2xl text-ink">Costo por defecto</h2>
            <p className="mt-1 text-xs text-ink-mute">
              Se aplica cuando el código postal del cliente NO coincide con ninguna zona configurada.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
            Activo
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Costo (MXN)</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultCost}
                onChange={(e) => setDefaultCost(e.target.value)}
                className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                placeholder="99.00"
              />
            </div>
            <p className="mt-1 text-[10px] text-ink-mute">Costo flat para todo el país sin zona</p>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Gratis desde (MXN)</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultFreeFrom}
                onChange={(e) => setDefaultFreeFrom(e.target.value)}
                className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                placeholder="1500.00"
              />
            </div>
            <p className="mt-1 text-[10px] text-ink-mute">Subtotal pre-promo para envío gratis</p>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Tiempo estimado</span>
            <input
              value={defaultDays}
              onChange={(e) => setDefaultDays(e.target.value)}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
              placeholder="2-4 días hábiles"
            />
            <p className="mt-1 text-[10px] text-ink-mute">Visible en el checkout</p>
          </label>
        </div>

        {defaultCost && parseMXN(defaultCost) != null && parseMXN(defaultCost)! > 0 && (
          <p className="mt-3 text-[11px] text-emerald-300/80">
            💡 Vista previa: <strong>{formatMXN(parseMXN(defaultCost) ?? 0)}</strong> de envío
            {defaultFreeFrom && parseMXN(defaultFreeFrom) ? `, gratis desde ${formatMXN(parseMXN(defaultFreeFrom) ?? 0)}` : ""}
          </p>
        )}
      </section>

      {/* SECCIÓN 2: Override global */}
      <section className={`liquid-glass rounded-2xl p-5 border-2 transition-colors ${
        overrideEnabled ? "border-gold/50" : "border-transparent"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display italic text-2xl text-ink">Override global</h2>
            <p className="mt-1 text-xs text-ink-mute">
              Si está activo, <strong className="text-rose-300/80">ignora las zonas por CP</strong> y cobra siempre el costo de override.
              Útil para promociones temporales tipo "Black Friday: envío a $X en todo México".
            </p>
          </div>
          <label className="shrink-0 flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-ink-mute">{overrideEnabled ? "Activado" : "Desactivado"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={overrideEnabled}
              onClick={() => setOverrideEnabled(!overrideEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                overrideEnabled ? "bg-gold" : "bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  overrideEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        {overrideEnabled && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Costo (MXN) *</span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={overrideCost}
                  onChange={(e) => setOverrideCost(e.target.value)}
                  className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="49.00 (0 = gratis total)"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Gratis desde (MXN)</span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={overrideFreeFrom}
                  onChange={(e) => setOverrideFreeFrom(e.target.value)}
                  className="w-full bg-black/40 border border-line rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="800.00"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Etiqueta para el cliente</span>
              <input
                value={overrideLabel}
                onChange={(e) => setOverrideLabel(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                placeholder="Envío express nacional"
              />
              <p className="mt-1 text-[10px] text-ink-mute">Nombre que verá el cliente en el checkout</p>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Tiempo estimado</span>
              <input
                value={overrideDays}
                onChange={(e) => setOverrideDays(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                placeholder="1-2 días hábiles"
              />
            </label>
          </div>
        )}

        {overrideEnabled && !overrideCost && (
          <p className="mt-3 text-[11px] text-rose-300/80">
            ⚠ Define un costo (0 = gratis para todos los pedidos) o desactiva el override.
          </p>
        )}
      </section>

      {/* Botón guardar */}
      <div className="flex items-center gap-3 sticky bottom-4 liquid-glass rounded-2xl p-3 backdrop-blur">
        <div className="flex-1">
          <p className="text-xs text-ink-mute">
            Última actualización: {config?.updated_at ? new Date(config.updated_at).toLocaleString("es-MX") : "—"}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gold text-bg px-6 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}

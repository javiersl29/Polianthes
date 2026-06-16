"use client";
import { useState } from "react";
import { toast } from "sonner";

type Promotion = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  value: number;
  required_size_ml: number;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  image_ai_generated: boolean;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  "3x2": "3x2 (lleva 3, paga 2)",
  "2x1": "2x1 (lleva 2, paga 1)",
  "percent": "Descuento %",
  "fixed": "Descuento fijo",
  "bundle": "Paquete/Combo",
  "free_shipping": "Envío gratis"
};

const COLOR_OPTIONS: { value: string; label: string; cls: string }[] = [
  { value: "gold", label: "Dorado", cls: "from-gold/30 to-amber-300/20 text-gold border-gold/40" },
  { value: "rose", label: "Rosa", cls: "from-rose-400/30 to-pink-300/20 text-rose-300 border-rose-300/40" },
  { value: "sky", label: "Cielo", cls: "from-sky-400/30 to-cyan-300/20 text-sky-300 border-sky-300/40" },
  { value: "emerald", label: "Esmeralda", cls: "from-emerald-400/30 to-teal-300/20 text-emerald-300 border-emerald-300/40" },
  { value: "violet", label: "Violeta", cls: "from-violet-400/30 to-purple-300/20 text-violet-300 border-violet-300/40" }
];

const PROMO_PRESETS: { label: string; type: string; quantity_to_take: number; quantity_to_pay: number; value: number; required_size_ml: number }[] = [
  { label: "3x2 en 60ml", type: "3x2", quantity_to_take: 3, quantity_to_pay: 2, value: 0, required_size_ml: 60 },
  { label: "2x1 en 30ml", type: "2x1", quantity_to_take: 2, quantity_to_pay: 1, value: 0, required_size_ml: 30 },
  { label: "20% de descuento", type: "percent", quantity_to_take: 0, quantity_to_pay: 0, value: 20, required_size_ml: 0 },
  { label: "$100 de descuento", type: "fixed", quantity_to_take: 0, quantity_to_pay: 0, value: 10000, required_size_ml: 0 },
  { label: "Envío gratis", type: "free_shipping", quantity_to_take: 0, quantity_to_pay: 0, value: 0, required_size_ml: 0 },
  { label: "Paquete regalo", type: "bundle", quantity_to_take: 3, quantity_to_pay: 3, value: 0, required_size_ml: 0 }
];

const empty = (): Partial<Promotion> => ({
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  type: "3x2",
  value: 0,
  required_size_ml: 60,
  quantity_to_take: 3,
  quantity_to_pay: 2,
  image_url: "",
  badge_text: "",
  badge_color: "gold",
  min_items: 0,
  max_items: 0,
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: "",
  active: true,
  sort_order: 0
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function PromocionesClient({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promos, setPromos] = useState<Promotion[]>(initialPromotions);
  const [editing, setEditing] = useState<Partial<Promotion> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");

  async function reload() {
    const r = await fetch("/api/admin/promotions");
    const data = await r.json();
    setPromos(data.promotions ?? []);
  }

  function startNew() {
    setEditing(empty());
    setIsNew(true);
    setImagePrompt("");
  }

  function startEdit(p: Promotion) {
    setEditing({
      ...p,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : ""
    });
    setIsNew(false);
    setImagePrompt(p.image_ai_generated && p.image_url ? "" : "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editing };
      if (body.starts_at && typeof body.starts_at === "string") {
        body.starts_at = new Date(body.starts_at).toISOString();
      } else body.starts_at = undefined;
      if (body.ends_at && typeof body.ends_at === "string" && body.ends_at !== "") {
        body.ends_at = new Date(body.ends_at).toISOString();
      } else body.ends_at = null;
      if (isNew) {
        if (!body.slug) body.slug = slugify(String(body.title ?? ""));
        const r = await fetch("/api/admin/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        toast.success("Promoción creada");
        setEditing(null);
        await reload();
      } else {
        const r = await fetch(`/api/admin/promotions/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        toast.success("Promoción actualizada");
        setEditing(null);
        await reload();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function del(p: Promotion) {
    if (!confirm(`¿Eliminar promoción "${p.title}"?`)) return;
    try {
      const r = await fetch(`/api/admin/promotions/${p.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Eliminada");
      await reload();
    } catch {
      toast.error("Error al eliminar");
    }
  }

  async function toggleActive(p: Promotion) {
    const r = await fetch(`/api/admin/promotions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active })
    });
    if (r.ok) {
      toast.success(p.active ? "Desactivada" : "Activada");
      await reload();
    }
  }

  async function generateImage() {
    if (!editing) return;
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        title: editing.title,
        type: editing.type,
        badge_color: editing.badge_color,
        prompt: imagePrompt || undefined,
        id: !isNew ? editing.id : undefined
      };
      const r = await fetch("/api/admin/promotions/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setEditing((e) => ({ ...e!, image_url: data.image_url }));
      toast.success("Imagen generada con IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando imagen");
    } finally {
      setGenerating(false);
    }
  }

  function applyPreset(preset: typeof PROMO_PRESETS[number]) {
    if (!editing) return;
    setEditing({
      ...editing,
      type: preset.type,
      value: preset.value,
      required_size_ml: preset.required_size_ml,
      quantity_to_take: preset.quantity_to_take,
      quantity_to_pay: preset.quantity_to_pay,
      title: editing.title || preset.label,
      badge_text: editing.badge_text || preset.label
    });
  }

  const colorCls = (color: string) => COLOR_OPTIONS.find((c) => c.value === color)?.cls ?? COLOR_OPTIONS[0].cls;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-ink-mute">// Marketing</p>
          <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-2px]">Promociones del mes</h1>
          <p className="mt-2 text-sm text-ink-mute max-w-xl">
            Crea ofertas 3x2, 2x1, descuentos y paquetes. Aparecen en un carrusel en la página principal y los usuarios
            pueden adquirirlas rápidamente eligiendo sus fragancias.
          </p>
        </div>
        <button
          onClick={startNew}
          className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 transition-colors"
        >
          + Nueva promoción
        </button>
      </div>

      {/* Listado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promos.length === 0 && (
          <div className="col-span-full liquid-glass rounded-2xl p-8 text-center text-ink-mute">
            <p>Aún no hay promociones. Crea la primera con "+ Nueva promoción".</p>
          </div>
        )}
        {promos.map((p) => (
          <div
            key={p.id}
            className={`liquid-glass rounded-2xl overflow-hidden flex flex-col ${!p.active ? "opacity-60" : ""}`}
          >
            {p.image_url ? (
              <div className="aspect-[16/9] bg-black/30 overflow-hidden">
                <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[16/9] bg-gradient-to-br from-gold/20 to-bg grid place-items-center text-gold/40 text-4xl">🎁</div>
            )}
            <div className="p-4 space-y-2 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display italic text-lg text-ink truncate">{p.title}</h3>
                  {p.subtitle && <p className="text-xs text-ink-mute truncate">{p.subtitle}</p>}
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-gradient-to-br ${colorCls(p.badge_color)}`}>
                  {p.badge_text || TYPE_LABELS[p.type] || p.type}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ink-mute/60">
                <span>slug: {p.slug}</span>
                <span>·</span>
                <span>{TYPE_LABELS[p.type] ?? p.type}</span>
                {p.required_size_ml > 0 && <><span>·</span><span>{p.required_size_ml}ml</span></>}
              </div>
              <p className="text-[11px] text-ink-mute">
                {p.active ? "Activa" : "Inactiva"} · orden {p.sort_order}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <button
                  onClick={() => startEdit(p)}
                  className="flex-1 rounded-full liquid-glass border border-line/40 px-3 py-1.5 text-xs hover:border-gold/40"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="rounded-full liquid-glass border border-line/40 px-3 py-1.5 text-xs hover:border-gold/40"
                >
                  {p.active ? "Pausar" : "Activar"}
                </button>
                <button
                  onClick={() => del(p)}
                  className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10"
                  aria-label="Eliminar"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => !saving && !generating && setEditing(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong rounded-2xl max-w-3xl w-full p-5 sm:p-6 my-8"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display italic text-2xl text-ink">
                {isNew ? "Nueva promoción" : "Editar promoción"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-ink-mute hover:text-gold p-1"
                aria-label="Cerrar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {/* Presets */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Plantillas rápidas</p>
                <div className="flex flex-wrap gap-1.5">
                  {PROMO_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="rounded-full liquid-glass border border-line/40 px-2.5 py-1 text-[11px] hover:border-gold/40"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Título" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} />
                <Field label="Slug (URL)" value={editing.slug ?? ""} onChange={(v) => setEditing({ ...editing, slug: v })} placeholder="3x2-perfumes-60ml" />
                <Field label="Subtítulo" value={editing.subtitle ?? ""} onChange={(v) => setEditing({ ...editing, subtitle: v })} />
                <Field label="Texto del badge" value={editing.badge_text ?? ""} onChange={(v) => setEditing({ ...editing, badge_text: v })} placeholder="3x2" />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Descripción</p>
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold resize-y"
                  placeholder="Lleva 3 perfumes de 60ml y paga solo 2. Elige tus 3 fragancias favoritas."
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SelectField label="Tipo" value={editing.type ?? "bundle"} onChange={(v) => setEditing({ ...editing, type: v })} options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                <Field label="Tamaño requerido (ml)" type="number" value={String(editing.required_size_ml ?? 0)} onChange={(v) => setEditing({ ...editing, required_size_ml: Number(v) })} />
                <Field label="Lleva" type="number" value={String(editing.quantity_to_take ?? 3)} onChange={(v) => setEditing({ ...editing, quantity_to_take: Number(v) })} />
                <Field label="Paga" type="number" value={String(editing.quantity_to_pay ?? 2)} onChange={(v) => setEditing({ ...editing, quantity_to_pay: Number(v) })} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Descuento % (opcional)" type="number" value={String(editing.value ?? 0)} onChange={(v) => setEditing({ ...editing, value: Number(v) })} />
                <Field label="Mínimo items" type="number" value={String(editing.min_items ?? 0)} onChange={(v) => setEditing({ ...editing, min_items: Number(v) })} />
                <Field label="Máximo items (0=sin)" type="number" value={String(editing.max_items ?? 0)} onChange={(v) => setEditing({ ...editing, max_items: Number(v) })} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Orden" type="number" value={String(editing.sort_order ?? 0)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })} />
                <Field label="Inicio" type="datetime-local" value={editing.starts_at ?? ""} onChange={(v) => setEditing({ ...editing, starts_at: v })} />
                <Field label="Fin (opcional)" type="datetime-local" value={editing.ends_at ?? ""} onChange={(v) => setEditing({ ...editing, ends_at: v })} />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Color del badge</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, badge_color: c.value })}
                      className={`px-3 py-1.5 rounded-full text-xs border bg-gradient-to-br transition-all ${c.cls} ${editing.badge_color === c.value ? "ring-2 ring-gold" : "opacity-60 hover:opacity-100"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Imagen promocional</p>
                {editing.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-line/40 mb-2">
                    <img src={editing.image_url} alt={editing.title} className="w-full h-48 object-cover" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line/60 h-32 grid place-items-center text-ink-mute text-xs mb-2">
                    Sin imagen. Genera una con IA o pega una URL.
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                    placeholder="https://... o data:image/..."
                    className="flex-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    onClick={generateImage}
                    disabled={generating || !editing.title}
                    className="shrink-0 rounded-full bg-gold text-bg px-3 py-2 text-xs font-medium hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {generating ? (
                      <>
                        <span className="w-3 h-3 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                        Generando
                      </>
                    ) : (
                      <>✦ Generar con IA</>
                    )}
                  </button>
                </div>
                <input
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Prompt personalizado (opcional). Ej: 'three golden perfume bottles on marble with rose petals'"
                  className="mt-2 w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.active ?? false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="h-4 w-4 accent-gold"
                />
                Activa (visible en el carrusel)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-line/40">
              <button
                onClick={() => setEditing(null)}
                disabled={saving || generating}
                className="rounded-full liquid-glass border border-line px-4 py-2 text-sm hover:border-gold/40 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || generating || !editing.title}
                className="rounded-full bg-gold text-bg px-5 py-2 text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando…" : isNew ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gold/80">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gold/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-elev text-ink">{o.label}</option>
        ))}
      </select>
    </label>
  );
}

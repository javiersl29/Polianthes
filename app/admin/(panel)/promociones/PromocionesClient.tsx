"use client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type MixRule = { size_ml: number; qty: number };

type Promotion = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  value: number;
  bundle_price_cents: number;
  required_size_ml: number;
  mix_sizes: boolean;
  mix_config: MixRule[] | null;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  image_ai_generated: boolean;
  image_prompt: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  min_subtotal_cents: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PromoType = {
  id: string;
  label: string;
  short: string;
  icon: string;
  desc: string;
  example: string;
  color: string;
};

const PROMO_TYPES: PromoType[] = [
  { id: "3x2", label: "3x2", short: "Lleva 3, paga 2", icon: "🎁", desc: "El cliente elige 3 fragancias y paga solo 2. Las más baratas son gratis.", example: "Lleva 3 perfumes de 60ml y paga solo 2", color: "from-amber-500/20 to-orange-500/10 border-amber-500/30" },
  { id: "2x1", label: "2x1", short: "Lleva 2, paga 1", icon: "🎀", desc: "El cliente elige 2 fragancias y paga solo 1. La más barata es gratis.", example: "Lleva 2 perfumes de 30ml y paga solo 1", color: "from-pink-500/20 to-rose-500/10 border-pink-500/30" },
  { id: "bundle_qty", label: "Bundle de cantidad", short: "N unidades por $X", icon: "📦", desc: "Pack de N fragancias a precio fijo. Ideal para sets de regalo o muestras.", example: "3 perfumes de 10ml por $290", color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30" },
  { id: "bundle_mix", label: "Bundle mixto", short: "N×A + M×B por $X", icon: "🧩", desc: "Combina fragancias de distintos tamaños a precio fijo. Ej: 2 de 30ml + 1 de 10ml por $X.", example: "2 fragancias de 30ml + 1 de 10ml por $60", color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30" },
  { id: "second_unit", label: "2da unidad a X%", short: "Descuento en 2da", icon: "🏷️", desc: "La segunda unidad (y siguientes pares) tienen un % de descuento.", example: "2da unidad a 50% — lleva 2 perfumes, el segundo a mitad de precio", color: "from-violet-500/20 to-purple-500/10 border-violet-500/30" },
  { id: "percent", label: "Descuento %", short: "X% en todo", icon: "💯", desc: "Porcentaje de descuento sobre el subtotal del carrito.", example: "20% de descuento en toda la tienda", color: "from-sky-500/20 to-blue-500/10 border-sky-500/30" },
  { id: "fixed", label: "Descuento fijo", short: "$X de descuento", icon: "💵", desc: "Monto fijo de descuento sobre el subtotal (en pesos MXN).", example: "$100 de descuento en cualquier compra", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30" },
  { id: "free_shipping", label: "Envío gratis", short: "Sin costo de envío", icon: "🚚", desc: "El envío sale gratis al aplicar esta promoción.", example: "Envío gratis en pedidos seleccionados", color: "from-cyan-500/20 to-sky-500/10 border-cyan-500/30" },
  { id: "tiered", label: "Por niveles", short: "Más llevas, más ahorras", icon: "📊", desc: "Descuento escalonado según cantidad: 2 unidades X%, 3 unidades Y%, etc.", example: "Lleva 2 y obtén 10%, lleva 3 y obtén 20%", color: "from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/30" }
];

const COLOR_OPTIONS: { value: string; label: string; cls: string }[] = [
  { value: "gold", label: "Dorado", cls: "from-gold/30 to-amber-300/20 text-gold border-gold/40" },
  { value: "rose", label: "Rosa", cls: "from-rose-400/30 to-pink-300/20 text-rose-300 border-rose-300/40" },
  { value: "sky", label: "Cielo", cls: "from-sky-400/30 to-cyan-300/20 text-sky-300 border-sky-300/40" },
  { value: "emerald", label: "Esmeralda", cls: "from-emerald-400/30 to-teal-300/20 text-emerald-300 border-emerald-300/40" },
  { value: "violet", label: "Violeta", cls: "from-violet-400/30 to-purple-300/20 text-violet-300 border-violet-300/40" }
];

const QUICK_PRESETS: { label: string; type: string; config: Record<string, unknown> }[] = [
  { label: "3x2 en 60ml", type: "3x2", config: { quantity_to_take: 3, quantity_to_pay: 2, required_size_ml: 60, badge_text: "3x2 60ml" } },
  { label: "2x1 en 30ml", type: "2x1", config: { quantity_to_take: 2, quantity_to_pay: 1, required_size_ml: 30, badge_text: "2x1 30ml" } },
  { label: "3 perfumes 10ml por $290", type: "bundle_qty", config: { quantity_to_take: 3, bundle_price_cents: 29000, required_size_ml: 10, mix_sizes: false, badge_text: "PACK $290" } },
  { label: "Pack 5 por $450", type: "bundle_qty", config: { quantity_to_take: 5, bundle_price_cents: 45000, required_size_ml: 0, mix_sizes: true, badge_text: "PACK 5" } },
  { label: "2×30ml + 1×10ml = $60", type: "bundle_mix", config: { bundle_price_cents: 6000, mix_config: [{ size_ml: 30, qty: 2 }, { size_ml: 10, qty: 1 }], badge_text: "MIX $60" } },
  { label: "2da unidad a 50%", type: "second_unit", config: { value: 50, badge_text: "2DA 50%" } },
  { label: "20% en todo", type: "percent", config: { value: 20, badge_text: "20% OFF" } },
  { label: "$100 de descuento", type: "fixed", config: { value: 10000, badge_text: "-$100" } },
  { label: "Envío gratis", type: "free_shipping", config: { badge_text: "ENVÍO GRATIS" } }
];

const empty = (): Partial<Promotion> => ({
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  type: "3x2",
  value: 0,
  bundle_price_cents: 0,
  required_size_ml: 60,
  mix_sizes: false,
  mix_config: null,
  quantity_to_take: 3,
  quantity_to_pay: 2,
  image_url: "",
  image_ai_generated: false,
  badge_text: "",
  badge_color: "gold",
  min_items: 0,
  max_items: 0,
  min_subtotal_cents: 0,
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: "",
  active: true,
  sort_order: 0
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

function buildCustomerSummary(p: Partial<Promotion>): string {
  if (!p.type) return "Configura la promo";
  switch (p.type) {
    case "3x2":
      return `Llévate ${p.quantity_to_take ?? 3} fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""} y paga solo ${p.quantity_to_pay ?? 2}`;
    case "2x1":
      return `Llévate ${p.quantity_to_take ?? 2} fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""} y paga solo ${p.quantity_to_pay ?? 1}`;
    case "bundle_qty": {
      const price = p.bundle_price_cents ? money(p.bundle_price_cents) : "$X";
      const ml = p.required_size_ml ? ` de ${p.required_size_ml}ml` : (p.mix_sizes ? "" : " del mismo tamaño");
      return `${p.quantity_to_take ?? 3} fragancias${ml} por ${price}`;
    }
    case "second_unit":
      return `2da unidad (y siguientes pares) a ${p.value ?? 50}%`;
    case "percent":
      return `${p.value ?? 10}% de descuento en tu compra`;
    case "fixed":
      return `${p.value ? money(p.value) : "$X"} de descuento en tu compra`;
    case "free_shipping":
      return "Envío gratis al aplicar esta promoción";
    case "tiered":
      return "Más llevas, más ahorras";
    default:
      return p.subtitle || p.title || "Promoción especial";
  }
}

export default function PromocionesClient({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const [promos, setPromos] = useState<Promotion[]>(initialPromotions);
  const [editing, setEditing] = useState<Partial<Promotion> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [refImage, setRefImage] = useState<string>("");
  const [imageMode, setImageMode] = useState<"ai" | "upload" | "url">("ai");

  async function reload() {
    const r = await fetch("/api/admin/promotions");
    const data = await r.json();
    // Parsear mix_config de string JSON a array
    const parsed = (data.promotions ?? []).map((p: Promotion) => {
      if (p.mix_config && typeof p.mix_config === "string") {
        try { p.mix_config = JSON.parse(p.mix_config); } catch { p.mix_config = null; }
      }
      return p;
    });
    setPromos(parsed);
  }

  function startNew() {
    setEditing(empty());
    setIsNew(true);
    setImagePrompt("");
    setRefImage("");
    setImageMode("ai");
  }

  function startEdit(p: Promotion) {
    let mixConfig: MixRule[] | null = null;
    if (p.mix_config) {
      if (typeof p.mix_config === "string") {
        try { mixConfig = JSON.parse(p.mix_config); } catch { mixConfig = null; }
      } else if (Array.isArray(p.mix_config)) {
        mixConfig = p.mix_config;
      }
    }
    setEditing({
      ...p,
      mix_config: mixConfig,
      starts_at: p.starts_at ? new Date(p.starts_at).toISOString().slice(0, 16) : "",
      ends_at: p.ends_at ? new Date(p.ends_at).toISOString().slice(0, 16) : ""
    });
    setIsNew(false);
    setImagePrompt("");
    setRefImage("");
    setImageMode("ai");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editing };
      if (body.mix_config !== undefined) {
        // Serializar mix_config a JSON string para enviarlo al API
        if (body.mix_config === null || (Array.isArray(body.mix_config) && body.mix_config.length === 0)) {
          body.mix_config = null;
        } else {
          body.mix_config = JSON.stringify(body.mix_config);
        }
      }
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
        toast.success("✓ Promoción creada");
        setEditing(null);
        await reload();
        await revalidatePromoPages();
      } else {
        const r = await fetch(`/api/admin/promotions/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        toast.success("✓ Promoción actualizada");
        setEditing(null);
        await reload();
        await revalidatePromoPages();
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
      toast.success(p.active ? "Pausada" : "Activada");
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
        reference_image: refImage || undefined,
        id: !isNew ? editing.id : undefined
      };
      const r = await fetch("/api/admin/promotions/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setEditing((e) => ({ ...e!, image_url: data.image_url, image_ai_generated: true }));
      toast.success("✓ Imagen generada con IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando imagen");
    } finally {
      setGenerating(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, target: "image" | "reference") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen es muy grande (máx 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === "image") {
        setEditing((ed) => ({ ...ed!, image_url: result, image_ai_generated: false }));
        toast.success("✓ Imagen subida");
      } else {
        setRefImage(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function applyPreset(preset: typeof QUICK_PRESETS[number]) {
    if (!editing) return;
    setEditing({
      ...editing,
      type: preset.type,
      ...preset.config,
      title: editing.title || preset.label,
      badge_text: editing.badge_text || preset.config.badge_text || ""
    } as Partial<Promotion>);
    toast.success(`Plantilla "${preset.label}" aplicada`);
  }

  function setType(type: string) {
    if (!editing) return;
    const defaults: Record<string, Partial<Promotion>> = {
      "3x2": { quantity_to_take: 3, quantity_to_pay: 2, required_size_ml: 60, value: 0, bundle_price_cents: 0, mix_sizes: false, mix_config: null },
      "2x1": { quantity_to_take: 2, quantity_to_pay: 1, required_size_ml: 30, value: 0, bundle_price_cents: 0, mix_sizes: false, mix_config: null },
      bundle_qty: { quantity_to_take: 3, bundle_price_cents: 29000, required_size_ml: 10, mix_sizes: false, value: 0, quantity_to_pay: 3, mix_config: null },
      bundle_mix: { quantity_to_take: 3, bundle_price_cents: 6000, required_size_ml: 0, mix_sizes: false, value: 0, quantity_to_pay: 3, mix_config: [{ size_ml: 30, qty: 2 }, { size_ml: 10, qty: 1 }] },
      second_unit: { value: 50, quantity_to_take: 2, quantity_to_pay: 2, required_size_ml: 0, bundle_price_cents: 0, mix_sizes: false, mix_config: null },
      percent: { value: 20, quantity_to_take: 0, quantity_to_pay: 0, required_size_ml: 0, bundle_price_cents: 0, mix_sizes: false, min_subtotal_cents: 0, mix_config: null },
      fixed: { value: 10000, quantity_to_take: 0, quantity_to_pay: 0, required_size_ml: 0, bundle_price_cents: 0, mix_sizes: false, min_subtotal_cents: 0, mix_config: null },
      free_shipping: { value: 0, quantity_to_take: 0, quantity_to_pay: 0, required_size_ml: 0, bundle_price_cents: 0, mix_sizes: false, min_subtotal_cents: 0, mix_config: null },
      tiered: { value: 0, quantity_to_take: 3, quantity_to_pay: 3, required_size_ml: 0, bundle_price_cents: 0, mix_sizes: false, mix_config: null }
    };
    setEditing({ ...editing, type, ...(defaults[type] || {}) });
  }

  async function revalidatePromoPages() {
    try {
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: ["/", "/carrito", "/checkout"] })
      });
    } catch { /* noop */ }
  }

  const colorCls = (color: string) => COLOR_OPTIONS.find((c) => c.value === color)?.cls ?? COLOR_OPTIONS[0].cls;
  const currentType = PROMO_TYPES.find((t) => t.id === editing?.type);
  const customerSummary = useMemo(() => editing ? buildCustomerSummary(editing) : "", [editing]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-ink-mute">// Marketing</p>
          <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-2px]">Promociones del mes</h1>
          <p className="mt-2 text-sm text-ink-mute max-w-2xl">
            Crea ofertas 3x2, 2x1, packs por precio fijo, descuentos y más. Aparecen en un carrusel en la página principal.
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
        {promos.map((p) => {
          const t = PROMO_TYPES.find((x) => x.id === p.type);
          return (
            <div
              key={p.id}
              className={`liquid-glass rounded-2xl overflow-hidden flex flex-col ${!p.active ? "opacity-60" : ""}`}
            >
              {p.image_url ? (
                <div className="aspect-[16/9] bg-black/30 overflow-hidden">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`aspect-[16/9] bg-gradient-to-br ${t?.color || "from-gold/20 to-bg"} grid place-items-center text-4xl opacity-50`}>
                  {t?.icon || "🎁"}
                </div>
              )}
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display italic text-lg text-ink truncate">{p.title}</h3>
                    {p.subtitle && <p className="text-xs text-ink-mute truncate">{p.subtitle}</p>}
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border bg-gradient-to-br ${colorCls(p.badge_color)}`}>
                    {p.badge_text || t?.label || p.type}
                  </span>
                </div>
                <p className="text-xs text-ink/80 line-clamp-2">{p.subtitle || buildCustomerSummary(p)}</p>
                <div className="flex items-center gap-2 text-[10px] text-ink-mute/60">
                  <span>{t?.icon} {t?.label}</span>
                </div>
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
          );
        })}
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => !saving && !generating && setEditing(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong rounded-2xl max-w-4xl w-full p-5 sm:p-6 my-8"
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

            <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
              {/* ===== PASO 1: Tipo de promoción ===== */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-2">
                  1 · ¿Qué tipo de promoción es?
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROMO_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`text-left rounded-xl border p-3 transition-all bg-gradient-to-br ${t.color} ${
                        editing.type === t.id
                          ? "ring-2 ring-gold shadow-lg"
                          : "opacity-60 hover:opacity-100 hover:scale-[1.02]"
                      }`}
                    >
                      <div className="text-2xl mb-1">{t.icon}</div>
                      <div className="text-[12px] font-semibold text-ink leading-tight">{t.label}</div>
                      <div className="text-[10px] text-ink-mute mt-0.5">{t.short}</div>
                    </button>
                  ))}
                </div>
                {currentType && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-ink-mute">
                      💡 {currentType.desc}
                    </p>
                    <p className="text-[11px] text-gold/80">
                      Ej: {currentType.example}
                    </p>
                    {editing.type === "3x2" && (
                      <p className="text-[11px] text-rose-300/80">
                        ⚠️ 3x2 significa "lleva 3, paga 2" — no es un precio fijo. Si quieres un pack por $X, usa "Bundle de cantidad".
                      </p>
                    )}
                    {editing.type === "bundle_qty" && (
                      <p className="text-[11px] text-emerald-300/80">
                        ✓ "Bundle de cantidad" es ideal para packs a precio fijo como "3 fragancias por $290".
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ===== PASO 2: Plantillas rápidas ===== */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Plantillas rápidas</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="rounded-full liquid-glass border border-line/40 px-2.5 py-1 text-[11px] hover:border-gold/40 hover:text-gold transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== PASO 3: Campos contextuales según el tipo ===== */}
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-gold/80">
                  2 · Reglas de la promoción
                </p>

                {/* 3x2 / 2x1: cantidad y tamaño */}
                {(editing.type === "3x2" || editing.type === "2x1") && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label={`Cantidad a llevar`}
                      type="number"
                      value={String(editing.quantity_to_take ?? 3)}
                      onChange={(v) => {
                        const take = Number(v);
                        setEditing({ ...editing, quantity_to_take: take, quantity_to_pay: editing.type === "2x1" ? 1 : Math.max(1, take - 1) });
                      }}
                      help="¿Cuántas fragancias debe elegir el cliente?"
                    />
                    <Field
                      label={`Cantidad a pagar`}
                      type="number"
                      value={String(editing.quantity_to_pay ?? 2)}
                      onChange={(v) => setEditing({ ...editing, quantity_to_pay: Number(v) })}
                      help="¿Cuántas paga efectivamente?"
                    />
                    <SizeField
                      label="Tamaño (opcional)"
                      value={editing.required_size_ml ?? 0}
                      onChange={(v) => setEditing({ ...editing, required_size_ml: v })}
                      help="0 = cualquier tamaño"
                    />
                  </div>
                )}

                {/* bundle_mix: N×A + M×B por $X */}
                {editing.type === "bundle_mix" && (
                  <>
                    <Field
                      label="Precio del pack (MXN)"
                      type="number"
                      value={String((editing.bundle_price_cents ?? 0) / 100)}
                      onChange={(v) => setEditing({ ...editing, bundle_price_cents: Math.round(Number(v) * 100) })}
                      help="Precio fijo que paga el cliente por el bundle completo"
                      placeholder="60"
                    />
                    <div className="rounded-lg bg-black/30 border border-line/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-wider text-gold/80">Composición del bundle</p>
                        <button
                          type="button"
                          onClick={() => {
                            const cfg = editing.mix_config ?? [];
                            setEditing({ ...editing, mix_config: [...cfg, { size_ml: 30, qty: 1 }] });
                          }}
                          className="rounded-full border border-gold/40 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10"
                        >
                          + Agregar tamaño
                        </button>
                      </div>
                      <p className="text-[10px] text-ink-mute">
                        Define cuántos perfumes de cada tamaño debe elegir el cliente.
                      </p>
                      <div className="space-y-1.5">
                        {(editing.mix_config ?? []).map((rule, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-lg bg-bg/40 border border-line/30 p-2">
                            <span className="text-[10px] text-ink-mute w-6">{idx + 1}.</span>
                            <span className="text-[10px] text-ink-mute">Lleva</span>
                            <input
                              type="number"
                              min="1"
                              value={rule.qty}
                              onChange={(e) => {
                                const cfg = [...(editing.mix_config ?? [])];
                                cfg[idx] = { ...cfg[idx], qty: Math.max(1, Number(e.target.value)) };
                                setEditing({ ...editing, mix_config: cfg });
                              }}
                              className="w-14 bg-black/40 border border-line rounded px-2 py-1 text-xs text-white text-center"
                            />
                            <span className="text-[10px] text-ink-mute">de</span>
                            <select
                              value={rule.size_ml}
                              onChange={(e) => {
                                const cfg = [...(editing.mix_config ?? [])];
                                cfg[idx] = { ...cfg[idx], size_ml: Number(e.target.value) };
                                setEditing({ ...editing, mix_config: cfg });
                              }}
                              className="bg-black/40 border border-line rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="10">10ml (Travel)</option>
                              <option value="30">30ml (Standard)</option>
                              <option value="60">60ml (Large)</option>
                              <option value="100">100ml (Premium)</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const cfg = (editing.mix_config ?? []).filter((_, i) => i !== idx);
                                setEditing({ ...editing, mix_config: cfg.length > 0 ? cfg : null });
                              }}
                              className="ml-auto text-rose-300/80 hover:text-rose-300 p-1"
                              aria-label="Quitar regla"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                        {(editing.mix_config ?? []).length === 0 && (
                          <p className="text-[11px] text-ink-mute text-center py-2">
                            Agrega al menos una regla de tamaño.
                          </p>
                        )}
                      </div>
                      {editing.mix_config && editing.mix_config.length > 0 && (editing.bundle_price_cents ?? 0) > 0 && (
                        <div className="rounded-lg bg-bg/40 border border-gold/20 p-3 text-xs text-ink-mute">
                          <strong className="text-gold">Bundle:</strong>{" "}
                          {editing.mix_config.map((r, i) => (
                            <span key={i}>
                              {i > 0 && " + "}
                              {r.qty}× de {r.size_ml}ml
                            </span>
                          ))}{" "}
                          por <strong className="text-gold">{money(editing.bundle_price_cents ?? 0)}</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* bundle_qty: N por $X */}
                {editing.type === "bundle_qty" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Cantidad de fragancias"
                        type="number"
                        value={String(editing.quantity_to_take ?? 3)}
                        onChange={(v) => setEditing({ ...editing, quantity_to_take: Number(v) })}
                        help="¿Cuántas fragancias incluye el pack?"
                      />
                      <Field
                        label="Precio del pack (MXN)"
                        type="number"
                        value={String((editing.bundle_price_cents ?? 0) / 100)}
                        onChange={(v) => setEditing({ ...editing, bundle_price_cents: Math.round(Number(v) * 100) })}
                        help="Precio fijo que paga el cliente"
                        placeholder="290"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SizeField
                        label="Tamaño (opcional)"
                        value={editing.required_size_ml ?? 0}
                        onChange={(v) => setEditing({ ...editing, required_size_ml: v })}
                        help="0 = cualquier tamaño"
                      />
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-gold/80">Variedad</span>
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, mix_sizes: false })}
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
                              !editing.mix_sizes ? "bg-gold text-bg border-gold" : "border-line/40 text-ink-mute hover:border-gold/40"
                            }`}
                          >
                            Mismo tamaño
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, mix_sizes: true })}
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
                              editing.mix_sizes ? "bg-gold text-bg border-gold" : "border-line/40 text-ink-mute hover:border-gold/40"
                            }`}
                          >
                            Mezclar tamaños
                          </button>
                        </div>
                        <p className="text-[10px] text-ink-mute mt-1">¿El cliente puede mezclar 10ml + 30ml + 60ml?</p>
                      </label>
                    </div>
                    {editing.bundle_price_cents && editing.bundle_price_cents > 0 && editing.quantity_to_take && editing.quantity_to_take > 0 && (
                      <div className="rounded-lg bg-bg/40 border border-gold/20 p-3 text-xs text-ink-mute">
                        <strong className="text-gold">Ejemplo:</strong> {editing.quantity_to_take} fragancias cuestan normalmente ≈{" "}
                        <span className="line-through">{money(editing.quantity_to_take * 10000)}</span> (3 × 10ml) → con la promo pagan <strong className="text-gold">{money(editing.bundle_price_cents)}</strong>
                      </div>
                    )}
                  </>
                )}

                {/* second_unit */}
                {editing.type === "second_unit" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="% de descuento en 2da"
                      type="number"
                      value={String(editing.value ?? 50)}
                      onChange={(v) => setEditing({ ...editing, value: Number(v) })}
                      help="0-100% de descuento en la 2da unidad"
                    />
                    <SizeField
                      label="Tamaño (opcional)"
                      value={editing.required_size_ml ?? 0}
                      onChange={(v) => setEditing({ ...editing, required_size_ml: v })}
                      help="0 = cualquier tamaño"
                    />
                  </div>
                )}

                {/* percent */}
                {editing.type === "percent" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="% de descuento"
                        type="number"
                        value={String(editing.value ?? 20)}
                        onChange={(v) => setEditing({ ...editing, value: Number(v) })}
                        help="0-100%"
                      />
                      <SizeField
                        label="Tamaño (opcional)"
                        value={editing.required_size_ml ?? 0}
                        onChange={(v) => setEditing({ ...editing, required_size_ml: v })}
                        help="0 = cualquier tamaño"
                      />
                    </div>
                    <Field
                      label="Pedido mínimo para aplicar (MXN)"
                      type="number"
                      value={String((editing.min_subtotal_cents ?? 0) / 100)}
                      onChange={(v) => setEditing({ ...editing, min_subtotal_cents: Math.round(Number(v) * 100) })}
                      help="El cliente debe tener este subtotal mínimo en el carrito para que la promo se aplique. 0 = sin mínimo."
                      placeholder="0"
                    />
                  </div>
                )}

                {/* fixed */}
                {editing.type === "fixed" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Descuento fijo (MXN)"
                      type="number"
                      value={String((editing.value ?? 0) / 100)}
                      onChange={(v) => setEditing({ ...editing, value: Math.round(Number(v) * 100) })}
                      help="Monto en pesos que se descuenta"
                      placeholder="100"
                    />
                    <Field
                      label="Compra mínima (MXN, opcional)"
                      type="number"
                      value={String((editing.min_items ?? 0) / 100)}
                      onChange={(v) => setEditing({ ...editing, min_items: Math.round(Number(v) * 100) })}
                      help="0 = sin mínimo"
                    />
                  </div>
                )}

                {/* free_shipping */}
                {editing.type === "free_shipping" && (
                  <p className="text-xs text-ink-mute">El envío se hace gratis al aplicar esta promoción.</p>
                )}

                {/* tiered */}
                {editing.type === "tiered" && (
                  <p className="text-xs text-ink-mute">Configura el value como un JSON con los tiers. Ej: <code className="text-gold/80">[{`{qty:2,percent:10},{qty:3,percent:20}`}]</code></p>
                )}
              </div>

              {/* ===== PASO 4: Textos ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Título" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="Ej: 3 perfumes de 10ml por $290" />
                <Field label="Slug (URL)" value={editing.slug ?? ""} onChange={(v) => setEditing({ ...editing, slug: v })} placeholder="3-perfumes-10ml-290" />
                <Field label="Subtítulo" value={editing.subtitle ?? ""} onChange={(v) => setEditing({ ...editing, subtitle: v })} placeholder="Lleévate 3 fragancias de 10ml por solo $290" />
                <Field label="Texto del badge" value={editing.badge_text ?? ""} onChange={(v) => setEditing({ ...editing, badge_text: v })} placeholder="PACK $290" />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1">Descripción (opcional)</p>
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold resize-y"
                  placeholder="Elige 3 fragancias de 10ml y paga solo $290. Perfectas para probar nuevos aromas."
                />
              </div>

              {/* ===== PASO 5: Color y vigencia ===== */}
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Orden" type="number" value={String(editing.sort_order ?? 0)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })} />
                <Field label="Inicio" type="datetime-local" value={editing.starts_at ?? ""} onChange={(v) => setEditing({ ...editing, starts_at: v })} />
                <Field label="Fin (opcional)" type="datetime-local" value={editing.ends_at ?? ""} onChange={(v) => setEditing({ ...editing, ends_at: v })} />
                <Field label="Mín. items" type="number" value={String(editing.min_items ?? 0)} onChange={(v) => setEditing({ ...editing, min_items: Number(v) })} />
              </div>

              {/* Pedido mínimo (para tipos que apliquen descuentos sobre subtotal) */}
              {(editing.type === "percent" || editing.type === "fixed" || editing.type === "second_unit" || editing.type === "free_shipping") && (
                <Field
                  label="Pedido mínimo para aplicar (MXN)"
                  type="number"
                  value={String((editing.min_subtotal_cents ?? 0) / 100)}
                  onChange={(v) => setEditing({ ...editing, min_subtotal_cents: Math.round(Number(v) * 100) })}
                  help="El cliente debe tener este subtotal mínimo en el carrito. 0 = sin mínimo."
                  placeholder="0"
                />
              )}

              {/* ===== PASO 6: Imagen ===== */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Imagen promocional</p>
                {editing.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-line/40 mb-2 relative group">
                    <img src={editing.image_url} alt={editing.title} className="w-full h-44 object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, image_url: "", image_ai_generated: false })}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white grid place-items-center hover:bg-rose-500 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                    {editing.image_ai_generated && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider bg-gold/90 text-bg font-semibold">IA</span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line/60 h-28 grid place-items-center text-ink-mute text-xs mb-2">
                    Sin imagen todavía
                  </div>
                )}

                <div className="flex gap-1 mb-2.5 p-1 rounded-lg bg-black/30 border border-line/40">
                  {([
                    { v: "ai", l: "Generar con IA" },
                    { v: "upload", l: "Subir imagen" },
                    { v: "url", l: "Pegar URL" }
                  ] as const).map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setImageMode(t.v)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${imageMode === t.v ? "bg-gold text-bg" : "text-ink-mute hover:text-ink"}`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>

                {imageMode === "ai" && (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Imagen de referencia (opcional)</p>
                      {refImage ? (
                        <div className="relative rounded-lg overflow-hidden border border-line/40 mb-1.5 inline-block">
                          <img src={refImage} alt="Referencia" className="h-20 object-cover" />
                          <button
                            type="button"
                            onClick={() => setRefImage("")}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white grid place-items-center hover:bg-rose-500"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-line/50 px-3 py-2 text-[11px] text-ink-mute hover:border-gold/40 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7M16 6l-4-4-4 4M12 2v13" /></svg>
                          Subir imagen base para que la IA la transforme
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "reference")} />
                        </label>
                      )}
                    </div>
                    <input
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Prompt personalizado (opcional). Ej: 'three golden perfume bottles on marble with rose petals, dark background'"
                      className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      onClick={generateImage}
                      disabled={generating || !editing.title}
                      className="w-full rounded-full bg-gold text-bg px-4 py-2.5 text-xs font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generating ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                          Generando con Nano Banana…
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /></svg>
                          {refImage ? "Generar desde referencia" : "Generar con IA"}
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-ink-mute/60 text-center">
                      Modelo: gemini-3.1-flash-image (Nano Banana) · 16:9
                    </p>
                  </div>
                )}

                {imageMode === "upload" && (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-line/50 px-4 py-8 text-center hover:border-gold/40 transition-colors">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gold/60"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    <span className="text-xs text-ink">Haz clic para subir una imagen</span>
                    <span className="text-[10px] text-ink-mute">PNG, JPG, WebP · máx 8MB · 16:9 recomendado</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                  </label>
                )}

                {imageMode === "url" && (
                  <input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value, image_ai_generated: false })}
                    placeholder="https://ejemplo.com/banner.jpg"
                    className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold"
                  />
                )}
              </div>

              {/* ===== Preview en vivo ===== */}
              <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-bg-elev p-4">
                <p className="text-[10px] uppercase tracking-wider text-gold/80 mb-2">Vista previa (lo que verá el cliente)</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentType?.icon || "🎁"}</span>
                  <div>
                    <p className="font-display italic text-lg text-ink leading-tight">
                      {editing.title || "Sin título"}
                    </p>
                    <p className="text-xs text-ink-mute mt-0.5">{customerSummary}</p>
                  </div>
                </div>
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
                {saving ? "Guardando…" : isNew ? "Crear promoción" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, help }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; help?: string }) {
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
      {help && <p className="text-[10px] text-ink-mute mt-0.5">{help}</p>}
    </label>
  );
}

function SizeField({ label, value, onChange, help }: { label: string; value: number; onChange: (v: number) => void; help?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gold/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
      >
        <option value="0">Cualquier tamaño</option>
        <option value="10">10ml (Travel)</option>
        <option value="30">30ml (Standard)</option>
        <option value="60">60ml (Large)</option>
        <option value="100">100ml (Premium)</option>
      </select>
      {help && <p className="text-[10px] text-ink-mute mt-0.5">{help}</p>}
    </label>
  );
}

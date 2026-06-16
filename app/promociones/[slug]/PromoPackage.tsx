"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/components/CartProvider";

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
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
};

type Fragrance = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  display_code: string | null;
  artistic_name: string | null;
  inspired_by_name: string | null;
  inspired_by_brand: string | null;
  image_url: string | null;
  image_version: number | null;
  gender: string;
  price_cents: number | null;
};

function money(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

export default function PromoPackage({ promo, fragrances }: { promo: Promotion; fragrances: Fragrance[] }) {
  const router = useRouter();
  const { add, clear, items, total } = useCart();

  const isQuantityPromo = promo.type === "3x2" || promo.type === "2x1";
  const take = isQuantityPromo ? promo.quantity_to_take || 3 : 1;
  const pay = isQuantityPromo ? promo.quantity_to_pay || 2 : 1;
  const requiredMl = promo.required_size_ml;
  const isPercent = promo.type === "percent";
  const isFixed = promo.type === "fixed";
  const isFreeShipping = promo.type === "free_shipping";

  const [selected, setSelected] = useState<Fragrance[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return fragrances;
    const t = search.toLowerCase();
    return fragrances.filter((f) =>
      `${f.full_name} ${f.brand} ${f.family ?? ""}`.toLowerCase().includes(t)
    );
  }, [fragrances, search]);

  function toggle(f: Fragrance) {
    setSelected((prev) => {
      if (prev.find((p) => p.id === f.id)) {
        return prev.filter((p) => p.id !== f.id);
      }
      if (isQuantityPromo) {
        if (prev.length >= take) {
          toast.error(`Solo puedes elegir ${take} fragancias para esta promo`);
          return prev;
        }
        return [...prev, f];
      }
      return [f];
    });
  }

  const count = selected.length;
  const itemsCount = isQuantityPromo ? take : 1;
  const allSelected = count === itemsCount;

  // Calcular el precio estimado
  const subtotalCents = selected.reduce((s, f) => s + (f.price_cents ?? 0), 0);
  const discountCents = isPercent ? Math.round(subtotalCents * (promo.value / 100)) : (isFixed ? promo.value : 0);
  const paidCents = subtotalCents - discountCents;
  const payCount = isQuantityPromo ? pay : 1;

  function claim() {
    if (!allSelected) {
      toast.error(`Elige ${itemsCount} fragancia${itemsCount > 1 ? "s" : ""} para continuar`);
      return;
    }
    // Limpiar carrito y agregar las fragancias con la promo aplicada
    clear();

    for (const f of selected) {
      add({
        slug: f.slug,
        brand: f.brand,
        name: f.name,
        artistic_name: f.artistic_name ?? null,
        full_name: f.full_name,
        image_url: f.image_url,
        image_version: f.image_version,
        size_ml: requiredMl || 0,
        qty: 1,
        unit_price_cents: f.price_cents ?? 0
      });
    }

    // Pasar la promo al checkout via query string
    const params = new URLSearchParams();
    params.set("promo", promo.slug);
    params.set("promo_type", promo.type);
    if (isPercent) params.set("promo_value", String(promo.value));
    if (isFixed) params.set("promo_discount_cents", String(promo.value));
    if (isQuantityPromo) {
      params.set("promo_take", String(take));
      params.set("promo_pay", String(pay));
    }
    router.push(`/checkout?${params.toString()}`);
  }

  const colorClass = {
    gold: "from-gold/30 to-amber-300/20 text-gold border-gold/40",
    rose: "from-rose-400/30 to-pink-300/20 text-rose-300 border-rose-300/40",
    sky: "from-sky-400/30 to-cyan-300/20 text-sky-300 border-sky-300/40",
    emerald: "from-emerald-400/30 to-teal-300/20 text-emerald-300 border-emerald-300/40",
    violet: "from-violet-400/30 to-purple-300/20 text-violet-300 border-violet-300/40"
  }[promo.badge_color] ?? "from-gold/30 to-amber-300/20 text-gold border-gold/40";

  return (
    <div className="mt-6 sm:mt-8 space-y-6">
      {/* Resumen de la promo */}
      <div className={`liquid-glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br ${colorClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-70">Esta oferta</p>
            <p className="text-2xl sm:text-3xl font-display italic">
              {promo.type === "3x2" && `3x2 en fragancias de ${requiredMl}ml`}
              {promo.type === "2x1" && `2x1 en fragancias de ${requiredMl}ml`}
              {promo.type === "percent" && `${promo.value}% de descuento`}
              {promo.type === "fixed" && `$${(promo.value / 100).toLocaleString("es-MX")} de descuento`}
              {promo.type === "bundle" && "Paquete especial"}
              {promo.type === "free_shipping" && "Envío gratis"}
            </p>
            {requiredMl > 0 && (
              <p className="text-xs opacity-70 mt-1">Presentación de {requiredMl}ml</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider opacity-70">Tu selección</p>
            <p className="text-2xl font-display italic">
              {count}<span className="opacity-50">/{itemsCount}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="liquid-glass rounded-xl flex items-center gap-2 px-4 py-3 min-h-[48px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar fragancias de ${requiredMl}ml…`}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-ink-mute hover:text-gold p-1" aria-label="Limpiar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Grid de fragancias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full liquid-glass rounded-2xl p-8 text-center text-ink-mute">
            <p>No hay fragancias de {requiredMl}ml disponibles para esta promo.</p>
          </div>
        ) : (
          filtered.map((f) => {
            const isSelected = selected.find((p) => p.id === f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f)}
                className={`liquid-glass rounded-2xl p-3 text-left transition-all relative ${isSelected ? "ring-2 ring-gold scale-[0.98]" : "hover:scale-[1.02]"}`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-gold text-bg grid place-items-center text-xs font-bold">
                    {selected.findIndex((p) => p.id === f.id) + 1}
                  </span>
                )}
                <div className="aspect-[3/4] rounded-xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute">
                  {f.image_url ? (
                    <img
                      src={f.image_version != null ? `${f.image_url}?v=${f.image_version}` : f.image_url}
                      alt={f.full_name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display italic text-gold text-3xl">{f.brand[0]}</span>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-gold/80 uppercase tracking-wider truncate">
                  {f.display_code ?? `PLT-${String(f.id).padStart(3, "0")}`}
                </p>
                <p className="text-sm font-medium text-ink leading-tight line-clamp-2">
                  {f.artistic_name ?? f.name}
                </p>
                <p className="text-[10px] text-ink-mute truncate">
                  {f.brand} {f.family && `· ${f.family}`}
                </p>
                {f.price_cents !== null && (
                  <p className="text-[11px] text-gold mt-1">{money(f.price_cents)}</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Resumen + CTA */}
      <div className="sticky bottom-4 mt-6">
        <div className="liquid-glass-strong rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            {allSelected ? (
              <>
                <p className="text-ink">Subtotal: <span className="text-ink-mute line-through">{money(subtotalCents)}</span></p>
                {discountCents > 0 && (
                  <p className="text-emerald-300 text-xs">Descuento: −{money(discountCents)}</p>
                )}
                {isQuantityPromo && take > pay && (
                  <p className="text-emerald-300 text-xs">Ahorras {take - pay} fragancia{take - pay > 1 ? "s" : ""}</p>
                )}
                <p className="font-display italic text-2xl text-gold">{money(paidCents)}</p>
              </>
            ) : (
              <p className="text-ink-mute">
                Elige {itemsCount - count} fragancia{itemsCount - count === 1 ? "" : "s"} más
                {requiredMl > 0 && ` de ${requiredMl}ml`}
              </p>
            )}
          </div>
          <button
            onClick={claim}
            disabled={!allSelected}
            className="rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] flex items-center gap-2"
          >
            {allSelected ? (
              <>Continuar al pago <span>→</span></>
            ) : (
              <>Elige {itemsCount} fragancia{itemsCount > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  bundle_price_cents: number;
  required_size_ml: number;
  mix_sizes: boolean;
  mix_config: Array<{ size_ml: number; qty: number }> | null;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  min_subtotal_cents: number;
};

type Presentation = { size_ml: number; price_cents: number };

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
  /** Todas las presentaciones disponibles para esta fragancia */
  presentations: Presentation[];
};

/** Item seleccionado: una fragancia + una presentación específica */
type SelectedItem = {
  fragrance: Fragrance;
  size_ml: number;
  price_cents: number;
};

function money(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

const SIZE_LABELS: Record<number, string> = {
  10: "10ml",
  30: "30ml",
  60: "60ml",
  100: "100ml"
};

export default function PromoPackage({ promo, fragrances }: { promo: Promotion; fragrances: Fragrance[] }) {
  const router = useRouter();
  const { add, clear, setPromo } = useCart();

  const isQuantityPromo = promo.type === "3x2" || promo.type === "2x1" || promo.type === "bundle_qty";
  const isBundleMix = promo.type === "bundle_mix";
  const isBundleQty = promo.type === "bundle_qty";
  const take = isQuantityPromo ? promo.quantity_to_take || 3 : 1;
  const pay = isQuantityPromo ? promo.quantity_to_pay || 2 : 1;
  const requiredMl = promo.required_size_ml;
  const isPercent = promo.type === "percent";
  const isFixed = promo.type === "fixed";
  const isFreeShipping = promo.type === "free_shipping";
  const isSecondUnit = promo.type === "second_unit";
  const mixSizes = promo.mix_sizes;

  // Selección: array de SelectedItem
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [openPresentationFor, setOpenPresentationFor] = useState<number | null>(null); // fragrance.id cuyo selector de tamaño está abierto
  const [search, setSearch] = useState("");

  // Tamaños disponibles en este pack
  const availableSizes = useMemo(() => {
    if (isBundleMix && promo.mix_config) {
      return Array.from(new Set(promo.mix_config.map((r) => r.size_ml))).sort((a, b) => a - b);
    }
    if (requiredMl > 0) return [requiredMl];
    return [10, 30, 60, 100];
  }, [isBundleMix, promo.mix_config, requiredMl]);

  const filtered = useMemo(() => {
    if (!search.trim()) return fragrances;
    const t = search.toLowerCase();
    return fragrances.filter((f) =>
      `${f.full_name} ${f.brand} ${f.family ?? ""}`.toLowerCase().includes(t)
    );
  }, [fragrances, search]);

  // Para bundle_mix: cuántas unidades de cada tamaño lleva el cliente
  const sizeProgress = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of selected) {
      map[s.size_ml] = (map[s.size_ml] ?? 0) + 1;
    }
    return map;
  }, [selected]);

  // Para bundle_mix: progreso por regla
  const mixRuleProgress = useMemo(() => {
    if (!isBundleMix || !promo.mix_config) return [];
    return promo.mix_config.map((rule) => ({
      ...rule,
      selected: sizeProgress[rule.size_ml] ?? 0,
      done: (sizeProgress[rule.size_ml] ?? 0) >= rule.qty
    }));
  }, [isBundleMix, promo.mix_config, sizeProgress]);

  const totalItems = selected.length;
  const allSelected = useMemo(() => {
    if (isQuantityPromo) return totalItems >= take;
    if (isBundleMix && promo.mix_config) {
      return mixRuleProgress.every((r) => r.done);
    }
    return totalItems >= 1;
  }, [isQuantityPromo, isBundleMix, totalItems, take, mixRuleProgress, promo.mix_config]);

  // Calcular precio estimado
  let subtotalCents = selected.reduce((s, it) => s + it.price_cents, 0);
  let discountCents = 0;
  let paidCents = subtotalCents;

  if (isBundleMix && promo.mix_config) {
    let minGroups = Infinity;
    for (const rule of promo.mix_config) {
      const matched = sizeProgress[rule.size_ml] ?? 0;
      minGroups = Math.min(minGroups, Math.floor(matched / rule.qty));
    }
    if (minGroups === Infinity) minGroups = 0;
    if (promo.bundle_price_cents > 0 && minGroups >= 1) {
      const bundleNormalCost = (() => {
        let total = 0;
        for (const rule of promo.mix_config) {
          const prices = selected
            .filter((s) => s.size_ml === rule.size_ml)
            .map((s) => s.price_cents)
            .sort((a, b) => a - b)
            .slice(0, rule.qty * minGroups);
          total += prices.reduce((s, p) => s + p, 0);
        }
        return total;
      })();
      discountCents = Math.max(0, bundleNormalCost - promo.bundle_price_cents * minGroups);
    }
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else if (isPercent) {
    discountCents = Math.round(subtotalCents * (promo.value / 100));
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else if (isFixed) {
    discountCents = Math.min(subtotalCents, promo.value);
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else if (isBundleQty && promo.bundle_price_cents > 0) {
    const groups = Math.floor(totalItems / take);
    const prices = selected.map((s) => s.price_cents).sort((a, b) => a - b);
    const normalCost = prices.slice(0, take * groups).reduce((s, p) => s + p, 0);
    discountCents = Math.max(0, normalCost - promo.bundle_price_cents * groups);
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else if (isSecondUnit && totalItems >= 2) {
    const prices = selected.map((s) => s.price_cents).sort((a, b) => b - a);
    const pairs = Math.floor(totalItems / 2);
    discountCents = prices.slice(0, pairs).reduce((s, p) => s + Math.round(p * (promo.value / 100)), 0);
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else if (promo.type === "3x2" || promo.type === "2x1") {
    const t = take;
    const p = pay;
    if (totalItems >= t) {
      const prices = selected.map((s) => s.price_cents).sort((a, b) => a - b);
      const freeAmount = prices.slice(0, t - p).reduce((s, x) => s + x, 0);
      discountCents = freeAmount;
      paidCents = Math.max(0, subtotalCents - discountCents);
    }
  }

  // Seleccionar/agregar una fragancia en un tamaño específico
  function addFragranceAt(fragrance: Fragrance, size_ml: number) {
    const presentation = fragrance.presentations.find((p) => p.size_ml === size_ml);
    if (!presentation) {
      toast.error("Esta fragancia no tiene esa presentación disponible");
      return;
    }

    // Para bundle_mix: validar que no exceda la regla de su tamaño
    if (isBundleMix && promo.mix_config) {
      const rule = promo.mix_config.find((r) => r.size_ml === size_ml);
      if (rule) {
        const current = sizeProgress[size_ml] ?? 0;
        if (current >= rule.qty) {
          toast.error(`Ya tienes ${rule.qty} fragancia(s) de ${size_ml}ml`);
          return;
        }
      }
    }

    // Para quantity promo: validar límite global
    if (isQuantityPromo && totalItems >= take) {
      // Si la fragancia ya está en el carrito, permitir toggle
      const already = selected.find((s) => s.fragrance.id === fragrance.id && s.size_ml === size_ml);
      if (!already) {
        toast.error(`Solo puedes elegir ${take} fragancias para esta promo`);
        return;
      }
    }

    // Si ya está, deseleccionar
    if (selected.find((s) => s.fragrance.id === fragrance.id && s.size_ml === size_ml)) {
      setSelected((prev) => prev.filter((s) => !(s.fragrance.id === fragrance.id && s.size_ml === size_ml)));
      return;
    }

    setSelected((prev) => [...prev, { fragrance, size_ml, price_cents: presentation.price_cents }]);
    setOpenPresentationFor(null);
  }

  function removeItem(idx: number) {
    setSelected((prev) => prev.filter((_, i) => i !== idx));
  }

  function claim() {
    if (!allSelected) {
      if (isBundleMix && promo.mix_config) {
        const missing = promo.mix_config
          .filter((r) => (sizeProgress[r.size_ml] ?? 0) < r.qty)
          .map((r) => `${r.qty - (sizeProgress[r.size_ml] ?? 0)}× de ${r.size_ml}ml`)
          .join(", ");
        toast.error(`Faltan: ${missing}`);
      } else {
        toast.error(`Elige ${take} fragancia${take > 1 ? "s" : ""} para continuar`);
      }
      return;
    }
    clear();
    for (const it of selected) {
      add({
        slug: it.fragrance.slug,
        brand: it.fragrance.brand,
        name: it.fragrance.name,
        artistic_name: it.fragrance.artistic_name ?? null,
        full_name: it.fragrance.full_name,
        image_url: it.fragrance.image_url,
        image_version: it.fragrance.image_version,
        size_ml: it.size_ml,
        qty: 1,
        unit_price_cents: it.price_cents
      });
    }

    setPromo({
      slug: promo.slug,
      type: promo.type as any,
      title: promo.title,
      quantity_to_take: promo.quantity_to_take,
      bundle_price_cents: promo.bundle_price_cents,
      value: promo.value,
      mix_sizes: promo.mix_sizes,
      required_size_ml: promo.required_size_ml,
      mix_config: promo.mix_config ?? undefined,
      source: "user"
    });

    const params = new URLSearchParams();
    params.set("promo", promo.slug);
    params.set("promo_type", promo.type);
    if (isPercent) params.set("promo_value", String(promo.value));
    if (isFixed) params.set("promo_discount_cents", String(promo.value));
    if (isQuantityPromo) {
      params.set("promo_take", String(take));
      params.set("promo_pay", String(pay));
    }
    if (isBundleQty || isBundleMix) {
      params.set("promo_bundle_price_cents", String(promo.bundle_price_cents));
    }
    if (isSecondUnit) {
      params.set("promo_value", String(promo.value));
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
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider opacity-70">Esta oferta</p>
            <p className="text-xl sm:text-2xl font-display italic">
              {promo.type === "3x2" && `3x2 en fragancias de ${requiredMl}ml`}
              {promo.type === "2x1" && `2x1 en fragancias de ${requiredMl}ml`}
              {promo.type === "bundle_qty" && `${take} fragancias${requiredMl ? ` de ${requiredMl}ml` : ""} por $${(promo.bundle_price_cents / 100).toLocaleString("es-MX")}`}
              {promo.type === "bundle_mix" && promo.mix_config && (
                <>{(promo.mix_config || []).map((r, i) => (
                  <span key={i}>
                    {i > 0 && " + "}
                    {r.qty}×{r.size_ml}ml
                  </span>
                ))} por ${(promo.bundle_price_cents / 100).toLocaleString("es-MX")}</>
              )}
              {promo.type === "second_unit" && `2da unidad a ${promo.value}%`}
              {promo.type === "percent" && `${promo.value}% de descuento`}
              {promo.type === "fixed" && `$${(promo.value / 100).toLocaleString("es-MX")} de descuento`}
              {promo.type === "bundle" && "Paquete especial"}
              {promo.type === "free_shipping" && "Envío gratis"}
            </p>
            <p className="text-[11px] opacity-70 mt-1">
              💡 Haz clic en una fragancia y elige su presentación
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider opacity-70">Tu selección</p>
            {isBundleMix && promo.mix_config ? (
              <div className="text-sm font-display italic leading-tight">
                {promo.mix_config.map((r) => {
                  const sel = sizeProgress[r.size_ml] ?? 0;
                  const done = sel >= r.qty;
                  return (
                    <div key={r.size_ml} className={done ? "text-emerald-300" : ""}>
                      {sel}/{r.qty} de {r.size_ml}ml {done && "✓"}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-2xl font-display italic">
                {totalItems}<span className="opacity-50">/{take}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="liquid-glass rounded-xl flex items-center gap-2 px-4 py-3 min-h-[48px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar fragancias…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-ink-mute hover:text-gold p-1" aria-label="Limpiar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Progreso por tamaño (bundle_mix) */}
      {isBundleMix && promo.mix_config && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-gold/80 mr-1">Progreso:</span>
          {promo.mix_config.map((rule) => {
            const sel = sizeProgress[rule.size_ml] ?? 0;
            const done = sel >= rule.qty;
            return (
              <span
                key={rule.size_ml}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                  done
                    ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/40"
                    : "bg-black/30 text-ink-mute border-line/40"
                }`}
              >
                {sel}/{rule.qty} de {rule.size_ml}ml {done && "✓"}
              </span>
            );
          })}
        </div>
      )}

      {/* Grid de fragancias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full liquid-glass rounded-2xl p-8 text-center text-ink-mute">
            <p>No hay fragancias disponibles para esta promo.</p>
          </div>
        ) : (
          filtered.map((f) => {
            const isOpen = openPresentationFor === f.id;
            const selectedForFragrance = selected.filter((s) => s.fragrance.id === f.id);
            const selectedCount = selectedForFragrance.length;
            const canAddMore = isBundleMix
              ? promo.mix_config!.every((r) => {
                  const cur = sizeProgress[r.size_ml] ?? 0;
                  const has = selectedForFragrance.find((s) => s.size_ml === r.size_ml);
                  // Para un tamaño en particular, podemos agregar si no alcanzamos el límite
                  return cur < r.qty || !!has;
                })
              : isQuantityPromo
                ? totalItems < take
                : true;

            return (
              <div
                key={f.id}
                className={`liquid-glass rounded-2xl p-3 text-left transition-all relative ${
                  selectedCount > 0 ? "ring-2 ring-gold" : ""
                }`}
              >
                {selectedCount > 0 && (
                  <span className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-gold text-bg grid place-items-center text-xs font-bold">
                    {selectedCount}
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

                {/* Selector inline de presentaciones */}
                <div className="mt-2 space-y-1">
                  {!isOpen && (
                    <button
                      type="button"
                      onClick={() => setOpenPresentationFor(isOpen ? null : f.id)}
                      className="w-full rounded-full bg-gold/15 border border-gold/30 px-2.5 py-1 text-[11px] text-gold hover:bg-gold/25 transition-colors flex items-center justify-center gap-1"
                    >
                      + Agregar
                    </button>
                  )}
                  {isOpen && (
                    <div className="rounded-lg bg-black/40 border border-gold/30 p-1.5 space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase tracking-wider text-ink-mute">Presentación</span>
                        <button
                          type="button"
                          onClick={() => setOpenPresentationFor(null)}
                          className="text-ink-mute hover:text-rose-300"
                          aria-label="Cerrar"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {f.presentations
                        .filter((p) => availableSizes.includes(p.size_ml))
                        .sort((a, b) => a.size_ml - b.size_ml)
                        .map((p) => {
                          const isSelected = selected.find((s) => s.fragrance.id === f.id && s.size_ml === p.size_ml);
                          const sizeLimit = isBundleMix
                            ? promo.mix_config!.find((r) => r.size_ml === p.size_ml)
                            : undefined;
                          const sizeFull = sizeLimit && (sizeProgress[p.size_ml] ?? 0) >= sizeLimit.qty && !isSelected;
                          const globalFull = isQuantityPromo && totalItems >= take && !isSelected;
                          const disabled = sizeFull || globalFull;
                          return (
                            <button
                              key={p.size_ml}
                              type="button"
                              disabled={disabled}
                              onClick={() => addFragranceAt(f, p.size_ml)}
                              className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                                isSelected
                                  ? "bg-gold text-bg"
                                  : disabled
                                    ? "bg-black/20 text-ink-mute/40 cursor-not-allowed"
                                    : "bg-black/30 text-ink hover:bg-gold/20"
                              }`}
                            >
                              <span className="font-semibold">{SIZE_LABELS[p.size_ml] ?? `${p.size_ml}ml`}</span>
                              <span className="font-mono">{money(p.price_cents)}</span>
                              {isSelected && <span className="text-[10px]">✓</span>}
                            </button>
                          );
                        })}
                      {f.presentations.filter((p) => availableSizes.includes(p.size_ml)).length === 0 && (
                        <p className="text-[10px] text-ink-mute text-center py-2">
                          No hay presentaciones disponibles
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lista de seleccionados */}
      {selected.length > 0 && (
        <div className="liquid-glass rounded-2xl p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gold/80">En tu pack ({selected.length})</p>
          <ul className="space-y-1.5">
            {selected.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink truncate">
                  <span className="text-ink-mute">{i + 1}.</span>{" "}
                  <strong className="text-gold">{SIZE_LABELS[s.size_ml] ?? `${s.size_ml}ml`}</strong>{" "}
                  · {s.fragrance.artistic_name ?? s.fragrance.name}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gold font-mono text-xs">{money(s.price_cents)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-rose-300/70 hover:text-rose-300"
                    aria-label="Quitar"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumen + CTA */}
      <div className="sticky bottom-4 mt-6">
        <div className="liquid-glass-strong rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            {allSelected ? (
              <>
                {isBundleQty || isBundleMix ? (
                  <>
                    <p className="text-ink">Precio del paquete: <span className="font-display italic text-xl text-gold">{money(promo.bundle_price_cents)}</span></p>
                    {subtotalCents > promo.bundle_price_cents && (
                      <p className="text-ink-mute text-xs line-through">{money(subtotalCents)} sin promoción</p>
                    )}
                    {discountCents > 0 && (
                      <p className="text-emerald-300 text-xs">Ahorras {money(discountCents)}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-ink">Subtotal: {discountCents > 0 && <span className="text-ink-mute line-through">{money(subtotalCents)}</span>}</p>
                    {discountCents > 0 && (
                      <p className="text-emerald-300 text-xs">Descuento: −{money(discountCents)}</p>
                    )}
                    {isQuantityPromo && take > pay && (
                      <p className="text-emerald-300 text-xs">Ahorras {take - pay} fragancia{take - pay > 1 ? "s" : ""}</p>
                    )}
                    <p className="font-display italic text-2xl text-gold">{money(paidCents)}</p>
                  </>
                )}
              </>
            ) : (
              <p className="text-ink-mute">
                {isBundleMix && promo.mix_config
                  ? "Completa la selección de todos los tamaños"
                  : <>Elige {take - totalItems} fragancia{take - totalItems === 1 ? "" : "s"} más
                      {requiredMl > 0 && promo.type !== "bundle_qty" && promo.type !== "bundle_mix" && ` de ${requiredMl}ml`}
                      {isBundleQty && requiredMl > 0 && ` de ${requiredMl}ml`}
                    </>
                }
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
              isBundleMix
                ? <>Completa la selección</>
                : <>Elige {take} fragancia{take > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
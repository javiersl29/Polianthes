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

type FragranceBySize = { size_ml: number; fragrances: Fragrance[] };

function money(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

export default function PromoPackage({ promo, fragrances, fragrancesBySize = [] }: { promo: Promotion; fragrances: Fragrance[]; fragrancesBySize?: FragranceBySize[] }) {
  const router = useRouter();
  const { add, clear, setPromo, items, total } = useCart();

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

  // Para bundle_mix, mantener selección agrupada por tamaño
  // selectedBySize: { [size_ml]: Fragrance[] }
  const [selectedBySize, setSelectedBySize] = useState<Record<number, Fragrance[]>>({});
  const [selected, setSelected] = useState<Fragrance[]>([]); // Para promos no-mix
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return fragrances;
    const t = search.toLowerCase();
    return fragrances.filter((f) =>
      `${f.full_name} ${f.brand} ${f.family ?? ""}`.toLowerCase().includes(t)
    );
  }, [fragrances, search]);

  function toggle(f: Fragrance) {
    if (isBundleMix && promo.mix_config) {
      // Buscar qué regla aplica a este fragrance (basado en su size_ml en presentation)
      // Para el cliente, agrupamos por tamaño usando mix_config
      const rule = promo.mix_config.find((r) => r.size_ml === (f as any).size_ml);
      if (!rule) {
        toast.error("Este tamaño no aplica para esta promo");
        return;
      }
      setSelectedBySize((prev) => {
        const list = prev[rule.size_ml] || [];
        if (list.find((p) => p.id === f.id)) {
          return { ...prev, [rule.size_ml]: list.filter((p) => p.id !== f.id) };
        }
        if (list.length >= rule.qty) {
          toast.error(`Solo puedes elegir ${rule.qty} fragancias de ${rule.size_ml}ml`);
          return prev;
        }
        return { ...prev, [rule.size_ml]: [...list, f] };
      });
      return;
    }
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

  // Para bundle_mix: contar selecciones y verificar que esté completo
  const mixProgress = isBundleMix && promo.mix_config ? promo.mix_config.map((r) => ({
    size_ml: r.size_ml,
    qty: r.qty,
    selected: (selectedBySize[r.size_ml] || []).length
  })) : [];
  const allMixSelected = isBundleMix ? mixProgress.every((p) => p.selected >= p.qty) : false;
  const totalSelectedCount = Object.values(selectedBySize).reduce((s, list) => s + list.length, 0);
  const count = isBundleMix ? totalSelectedCount : selected.length;
  const itemsCount = isQuantityPromo ? take : 1;
  const allSelected = isBundleMix ? allMixSelected : (count === itemsCount);

  // Calcular el precio estimado
  let subtotalCents = 0;
  let discountCents = 0;
  let paidCents = 0;

  if (isBundleMix && promo.mix_config) {
    // Subtotal = suma de cada fragancia en su size correspondiente
    for (const sizeKey of Object.keys(selectedBySize)) {
      for (const f of selectedBySize[Number(sizeKey)]) {
        subtotalCents += f.price_cents ?? 0;
      }
    }
    // Cuántos bundles se pueden formar (mínimo de grupos por cada regla)
    let minGroups = Infinity;
    for (const rule of promo.mix_config) {
      const matched = selectedBySize[rule.size_ml]?.length ?? 0;
      minGroups = Math.min(minGroups, Math.floor(matched / rule.qty));
    }
    if (minGroups === Infinity) minGroups = 0;
    if (promo.bundle_price_cents > 0 && minGroups >= 1) {
      // Descuento = (suma del bundle) - (precio del bundle × grupos)
      const bundleNormalCost = (() => {
        let total = 0;
        for (const rule of promo.mix_config) {
          const prices = (selectedBySize[rule.size_ml] ?? [])
            .map((f) => f.price_cents ?? 0)
            .sort((a, b) => a - b)
            .slice(0, rule.qty * minGroups);
          total += prices.reduce((s, p) => s + p, 0);
        }
        return total;
      })();
      discountCents = Math.max(0, bundleNormalCost - promo.bundle_price_cents * minGroups);
    }
    paidCents = Math.max(0, subtotalCents - discountCents);
  } else {
    subtotalCents = selected.reduce((s, f) => s + (f.price_cents ?? 0), 0);
    if (isPercent) {
      discountCents = Math.round(subtotalCents * (promo.value / 100));
    } else if (isFixed) {
      discountCents = promo.value;
    } else if (isBundleQty && promo.bundle_price_cents > 0) {
      const groups = Math.floor(selected.length / take);
      const normalCost = (() => {
        const prices = selected.map((f) => f.price_cents ?? 0).sort((a, b) => a - b);
        return prices.slice(0, take * groups).reduce((s, p) => s + p, 0);
      })();
      discountCents = Math.max(0, normalCost - promo.bundle_price_cents * groups);
    } else if (isSecondUnit && selected.length >= 2) {
      const prices = selected.map((f) => f.price_cents ?? 0).sort((a, b) => b - a);
      const pairs = Math.floor(selected.length / 2);
      discountCents = prices.slice(0, pairs).reduce((s, p) => s + Math.round(p * (promo.value / 100)), 0);
    }
    paidCents = Math.max(0, subtotalCents - discountCents);
  }
  const payCount = isQuantityPromo ? pay : 1;

  function claim() {
    if (!allSelected) {
      if (isBundleMix && promo.mix_config) {
        const missing = promo.mix_config
          .filter((r) => (selectedBySize[r.size_ml]?.length ?? 0) < r.qty)
          .map((r) => `${r.qty - (selectedBySize[r.size_ml]?.length ?? 0)}× de ${r.size_ml}ml`)
          .join(", ");
        toast.error(`Faltan: ${missing}`);
      } else {
        toast.error(`Elige ${itemsCount} fragancia${itemsCount > 1 ? "s" : ""} para continuar`);
      }
      return;
    }
    // Limpiar carrito y agregar las fragancias con la promo aplicada
    clear();

    if (isBundleMix && promo.mix_config) {
      // Agregar cada fragancia con su size_ml
      for (const sizeKey of Object.keys(selectedBySize)) {
        const sizeMl = Number(sizeKey);
        for (const f of selectedBySize[sizeMl]) {
          add({
            slug: f.slug,
            brand: f.brand,
            name: f.name,
            artistic_name: f.artistic_name ?? null,
            full_name: f.full_name,
            image_url: f.image_url,
            image_version: f.image_version,
            size_ml: sizeMl,
            qty: 1,
            unit_price_cents: f.price_cents ?? 0
          });
        }
      }
    } else {
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
    }

    // Guardar la promo en el cart para que el total refleje el descuento
    setPromo({
      slug: promo.slug,
      type: promo.type as any,
      title: promo.title,
      quantity_to_take: promo.quantity_to_take,
      bundle_price_cents: promo.bundle_price_cents,
      value: promo.value,
      mix_sizes: promo.mix_sizes,
      mix_config: promo.mix_config ?? undefined
    });

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
          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-70">Esta oferta</p>
            <p className="text-2xl sm:text-3xl font-display italic">
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
            {requiredMl > 0 && promo.type !== "bundle_qty" && promo.type !== "bundle_mix" && (
              <p className="text-xs opacity-70 mt-1">Presentación de {requiredMl}ml</p>
            )}
            {isBundleQty && mixSizes && (
              <p className="text-xs opacity-70 mt-1">Puedes mezclar tamaños</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider opacity-70">Tu selección</p>
            {isBundleMix && promo.mix_config ? (
              <div className="text-base font-display italic leading-tight">
                {promo.mix_config.map((r, i) => {
                  const sel = selectedBySize[r.size_ml]?.length ?? 0;
                  const done = sel >= r.qty;
                  return (
                    <div key={i} className={done ? "text-emerald-300" : ""}>
                      {sel}/{r.qty} de {r.size_ml}ml
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-2xl font-display italic">
                {count}<span className="opacity-50">/{itemsCount}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Para bundle_mix: grid unificado con todas las fragancias mezcladas */}
      {isBundleMix && promo.mix_config ? (
        <>
          {/* Progreso por tamaño */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-gold/80 mr-1">Progreso:</span>
            {promo.mix_config.map((rule) => {
              const sel = selectedBySize[rule.size_ml]?.length ?? 0;
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

          {/* Grid unificado de TODAS las fragancias */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(() => {
              // Aplanar todas las fragancias de todos los tamaños del mix
              const allFragrances: Array<Fragrance & { _size_ml: number }> = [];
              for (const g of fragrancesBySize) {
                for (const f of g.fragrances) {
                  allFragrances.push({ ...f, _size_ml: g.size_ml });
                }
              }
              const filtered = search.trim()
                ? allFragrances.filter((f) =>
                    `${f.full_name} ${f.brand} ${f.family ?? ""}`.toLowerCase().includes(search.toLowerCase())
                  )
                : allFragrances;

              if (filtered.length === 0) {
                return (
                  <div className="col-span-full liquid-glass rounded-2xl p-8 text-center text-ink-mute">
                    <p>No hay fragancias disponibles para este pack.</p>
                  </div>
                );
              }

              return filtered.map((f) => {
                const rule = promo.mix_config!.find((r) => r.size_ml === f._size_ml);
                if (!rule) return null;
                const sel = selectedBySize[f._size_ml] ?? [];
                const isSel = sel.find((p) => p.id === f.id);
                const sizeComplete = sel.length >= rule.qty;
                const disabled = !isSel && sizeComplete;

                return (
                  <button
                    key={`${f._size_ml}-${f.id}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle({ ...f, size_ml: f._size_ml } as any)}
                    className={`liquid-glass rounded-2xl p-3 text-left transition-all relative ${
                      isSel
                        ? "ring-2 ring-gold scale-[0.98]"
                        : disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:scale-[1.02]"
                    }`}
                  >
                    {isSel && (
                      <span className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-gold text-bg grid place-items-center text-xs font-bold">
                        {sel.findIndex((p) => p.id === f.id) + 1}
                      </span>
                    )}
                    {/* Badge de tamaño */}
                    <span className="absolute top-2 left-2 z-10 rounded-full bg-black/70 text-ink text-[9px] font-semibold px-2 py-0.5 backdrop-blur-sm">
                      {f._size_ml}ml
                    </span>
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
              });
            })()}
          </div>
        </>
      ) : (
        <>
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
        </>
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
                  : <>Elige {itemsCount - count} fragancia{itemsCount - count === 1 ? "" : "s"} más
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
                : <>Elige {itemsCount} fragancia{itemsCount > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

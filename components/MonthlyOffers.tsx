"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

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
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  min_subtotal_cents: number;
  starts_at: string;
  ends_at: string | null;
  sort_order: number;
};

const TYPE_LABELS: Record<string, string> = {
  "3x2": "3x2",
  "2x1": "2x1",
  "bundle_qty": "Bundle",
  "bundle_mix": "Mix",
  "second_unit": "2da unidad",
  "percent": "% OFF",
  "fixed": "MXN OFF",
  "bundle": "Paquete",
  "free_shipping": "Envío gratis",
  "tiered": "Por niveles"
};

const COLOR_CLASSES: Record<string, { gradient: string; ring: string; text: string; border: string }> = {
  gold: { gradient: "from-gold/30 via-amber-300/15 to-transparent", ring: "ring-gold/50", text: "text-gold", border: "border-gold/40" },
  rose: { gradient: "from-rose-400/30 via-pink-300/15 to-transparent", ring: "ring-rose-300/50", text: "text-rose-300", border: "border-rose-300/40" },
  sky: { gradient: "from-sky-400/30 via-cyan-300/15 to-transparent", ring: "ring-sky-300/50", text: "text-sky-300", border: "border-sky-300/40" },
  emerald: { gradient: "from-emerald-400/30 via-teal-300/15 to-transparent", ring: "ring-emerald-300/50", text: "text-emerald-300", border: "border-emerald-300/40" },
  violet: { gradient: "from-violet-400/30 via-purple-300/15 to-transparent", ring: "ring-violet-300/50", text: "text-violet-300", border: "border-violet-300/40" }
};

function buildPromoSummary(p: Promotion): string {
  switch (p.type) {
    case "3x2": return `Lleva 3 fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""} y paga solo 2`;
    case "2x1": return `Lleva 2 fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""} y paga solo 1`;
    case "bundle_qty": {
      const price = p.bundle_price_cents ? `$${(p.bundle_price_cents / 100).toLocaleString("es-MX")}` : "$X";
      const ml = p.required_size_ml ? ` de ${p.required_size_ml}ml` : "";
      return `Lleva ${p.quantity_to_take} fragancias${ml} por ${price}`;
    }
    case "bundle_mix": {
      const price = p.bundle_price_cents ? `$${(p.bundle_price_cents / 100).toLocaleString("es-MX")}` : "$X";
      return `Pack mixto a precio especial ${price}`;
    }
    case "second_unit": return `2da unidad (y siguientes pares) a ${p.value}%`;
    case "percent": {
      const minTxt = p.min_subtotal_cents > 0 ? ` en compras +$${(p.min_subtotal_cents / 100).toLocaleString("es-MX")}` : "";
      return `${p.value}% de descuento${minTxt}`;
    }
    case "fixed": return `$${(p.value / 100).toLocaleString("es-MX")} de descuento`;
    case "bundle": return "Paquete especial seleccionado a mano";
    case "free_shipping": return "Envío gratis sin mínimo de compra";
    default: return p.subtitle ?? "Promoción especial";
  }
}

export default function MonthlyOffers({ promotions }: { promotions: Promotion[] }) {
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<Promotion[]>(promotions);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = items.length;

  // Cargar imágenes client-side (evita inflar el SSR con data URLs)
  useEffect(() => {
    if (promotions.length === 0) return;
    let cancelled = false;
    fetch("/api/public/promotions")
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.promotions) return;
        // Mergear image_url de la API hacia los items del SSR
        const withImages = promotions.map(p => {
          const full = data.promotions.find((d: Promotion) => d.id === p.id);
          return full ? { ...p, image_url: full.image_url } : p;
        });
        setItems(withImages);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [promotions]);

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % total);
    }, 6500);
    return () => clearInterval(id);
  }, [total]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-card]");
    const card = cards[active];
    if (card) {
      const offset = card.offsetLeft - el.offsetLeft - 16;
      el.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [active]);

  function go(delta: number) {
    setActive((i) => (i + delta + total) % total);
  }

  if (total === 0) return null;

  return (
    <section id="ofertas" className="relative py-20 sm:py-32 px-4 overflow-hidden">
      {/* Glow de fondo */}
      <div className="pointer-events-none absolute inset-0 -z-0 opacity-40">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(closest-side, color-mix(in oklch, var(--color-gold) 12%, transparent), transparent 70%)", filter: "blur(40px)" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-8 sm:mb-12"
        >
          <p className="text-sm text-ink-mute">// Ofertas del mes</p>
          <h2 className="mt-2 font-display italic text-ink text-4xl sm:text-5xl md:text-7xl leading-[0.9] tracking-[-2px] sm:tracking-[-3px]">
            Promociones de temporada
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-mute max-w-2xl mx-auto px-2">
            3x2 en 60ml, descuentos exclusivos y paquetes curados. Elige tus fragancias y paga en un solo paso.
          </p>
        </motion.div>

        {/* Carrusel */}
        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {items.map((p, idx) => {
              const colors = COLOR_CLASSES[p.badge_color] ?? COLOR_CLASSES.gold;
              return (
                <article
                  key={p.id}
                  data-card
                  className="snap-start shrink-0 w-[88vw] sm:w-[480px] md:w-[560px] liquid-glass rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col"
                >
                  {/* Imagen */}
                  <Link
                    href={`/promociones/${p.slug}`}
                    className="block aspect-[16/9] bg-black/40 relative overflow-hidden group"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.title}
                        loading={idx === 0 ? "eager" : "lazy"}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-gold/15 to-bg-elev text-gold/40 text-5xl">
                        🎁
                      </div>
                    )}
                    {/* Badge */}
                    <span className={`absolute top-3 left-3 z-10 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-gradient-to-br ${colors.gradient} ${colors.text} ${colors.border} backdrop-blur-md`}>
                      {p.badge_text || TYPE_LABELS[p.type] || p.type}
                    </span>
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 z-10">
                      <h3 className="font-display italic text-2xl sm:text-3xl text-ink leading-tight">
                        {p.title}
                      </h3>
                    </div>
                  </Link>

                  {/* Contenido */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <p className="text-sm text-ink/90 leading-relaxed">
                      {p.subtitle ?? buildPromoSummary(p)}
                    </p>
                    {p.description && (
                      <p className="mt-2 text-xs text-ink-mute line-clamp-2">{p.description}</p>
                    )}
                    <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-wider text-ink-mute/60">
                        {p.ends_at ? `Hasta ${new Date(p.ends_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : "Por tiempo limitado"}
                      </span>
                      <Link
                        href={`/promociones/${p.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold text-bg px-4 py-2 text-xs font-medium hover:bg-gold/90 transition-colors"
                      >
                        Elegir fragancias
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Controles */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-gold text-bg grid place-items-center shadow-[0_4px_24px_rgba(201,162,39,0.5)] hover:scale-110 hover:shadow-[0_6px_32px_rgba(201,162,39,0.7)] active:scale-95 transition-all"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Siguiente"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-gold text-bg grid place-items-center shadow-[0_4px_24px_rgba(201,162,39,0.5)] hover:scale-110 hover:shadow-[0_6px_32px_rgba(201,162,39,0.7)] active:scale-95 transition-all"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {items.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActive(i)}
                aria-label={`Ir a ${p.title}`}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-gold" : "w-1.5 bg-ink-mute/30 hover:bg-ink-mute/60"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

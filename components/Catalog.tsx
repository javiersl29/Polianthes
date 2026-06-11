"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

type Gender = "hombre" | "mujer" | "unisex";
type Item = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  image_url: string | null;
  min_price_cents: number | null;
};

const FAMILIES = ["", "Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];
const GENDERS: ("all" | Gender)[] = ["all", "hombre", "mujer", "unisex"];

export default function Catalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [family, setFamily] = useState("");
  const [gender, setGender] = useState<"all" | Gender>("all");
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (note) params.set("note", note);
        if (gender !== "all") params.set("gender", gender);
        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const data = (await res.json()) as { items: Item[] };
        const filtered = family ? data.items.filter((i) => i.family === family) : data.items;
        setItems(filtered);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, note, family, gender]);

  const empty = useMemo(
    () => !loading && items.length === 0,
    [loading, items]
  );

  return (
    <section id="catalogo" className="relative py-20 sm:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 sm:gap-6 mb-8 sm:mb-10"
        >
          <div>
            <p className="text-sm text-ink-mute mb-3 sm:mb-4">// Catálogo</p>
            <h2 className="font-display italic text-ink text-4xl sm:text-5xl md:text-7xl leading-[0.9] tracking-[-2px] sm:tracking-[-3px]">
              La curaduría
            </h2>
          </div>
          <p className="text-ink-mute max-w-sm text-sm">
            Busca por nombre, marca o por una nota específica —ámbar, vetiver, oud, neroli— y deja que el
            buscador dinámico resalte las coincidencias.
          </p>
        </motion.div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="liquid-glass rounded-full px-4 py-2.5 sm:py-2 flex items-center gap-2 min-h-[44px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o marca"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
              />
            </div>
            <div className="liquid-glass rounded-full px-4 py-2.5 sm:py-2 flex items-center gap-2 min-h-[44px]">
              <span className="text-gold text-sm shrink-0">◎</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Buscar por nota: vainilla, vetiver, oud…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
              />
            </div>
          </div>

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="sm:hidden liquid-glass rounded-full px-4 py-2 text-sm text-ink/80 flex items-center gap-2 w-full justify-center min-h-[44px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          </button>

          <div className={`${filtersOpen ? "block" : "hidden"} sm:block`}>
            <div className="liquid-glass rounded-2xl sm:rounded-full px-2 py-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-2">
              {FAMILIES.map((f) => (
                <button
                  key={f || "todas"}
                  onClick={() => setFamily(f)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors shrink-0 ${
                    family === f ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
                  }`}
                >
                  {f || "Todas"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-ink-mute mr-1">Género</span>
              {GENDERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`liquid-glass rounded-full px-3 py-1.5 text-xs capitalize transition-colors min-h-[36px] ${
                    gender === g ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
                  }`}
                  aria-pressed={gender === g}
                >
                  {g === "all" ? "Todos" : g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {empty && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center text-ink-mute"
          >
            <p className="font-display italic text-xl sm:text-2xl text-ink">Sin coincidencias todavía</p>
            <p className="mt-2 text-sm">Prueba con otra nota o ajusta el nombre. Algunas fragancias aún no tienen notas documentadas.</p>
          </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {items.map((it, idx) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.4, ease: "easeOut" }}
            >
              <Link
                href={`/fragancias/${it.slug}`}
                className="liquid-glass rounded-2xl sm:rounded-3xl p-3 sm:p-4 hover:text-gold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold/5 group block"
              >
                <div className="aspect-[3/4] rounded-xl sm:rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.full_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="font-display italic text-gold text-3xl sm:text-4xl">{it.brand[0]}</span>
                  )}
                </div>
                <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] text-ink-mute uppercase tracking-wider truncate">{it.brand}</p>
                  <span className="text-[9px] sm:text-[10px] text-ink/70 capitalize shrink-0">{it.gender}</span>
                </div>
                <p className="font-display italic text-base sm:text-xl text-ink leading-tight mt-0.5">{it.name}</p>
                {it.family && <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-gold">{it.family}</p>}
                {it.min_price_cents !== null && it.min_price_cents > 0 && (
                  <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-ink/80">
                    Desde <span className="text-gold font-medium">${(it.min_price_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                  </p>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { genderBadge } from "@/lib/visual";

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
  image_version?: number | null;
  display_code: string | null;
  artistic_name: string | null;
  inspired_by_name: string | null;
  inspired_by_brand: string | null;
  min_price_cents: number | null;
};

const PAGE_SIZE = 60;
const FAMILIES = ["", "Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];
const GENDERS: ("all" | Gender)[] = ["all", "hombre", "mujer", "unisex"];

export default function Catalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [family, setFamily] = useState("");
  const [gender, setGender] = useState<"all" | Gender>("all");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterKey = `${query}|${note}|${family}|${gender}`;
  const filterKeyRef = useRef(filterKey);

  useEffect(() => {
    filterKeyRef.current = filterKey;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", "0");
        if (query) params.set("q", query);
        if (note) params.set("note", note);
        if (gender !== "all") params.set("gender", gender);
        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const data = (await res.json()) as { items: Item[]; total: number; hasMore: boolean };
        if (filterKeyRef.current !== filterKey) return;
        setItems(data.items);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setOffset(data.items.length);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        throw err;
      } finally {
        if (filterKeyRef.current === filterKey) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [filterKey, query, note, gender]);

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (query) params.set("q", query);
      if (note) params.set("note", note);
      if (gender !== "all") params.set("gender", gender);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = (await res.json()) as { items: Item[]; hasMore: boolean };
      setItems((prev) => [...prev, ...data.items]);
      setOffset((prev) => prev + data.items.length);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = useMemo(
    () => (family ? items.filter((i) => i.family === family) : items),
    [items, family]
  );

  const empty = useMemo(
    () => !loading && visible.length === 0,
    [loading, visible]
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
          {visible.map((it, idx) => (
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
                    <img
                      loading="lazy"
                      decoding="async"
                      src={it.image_version != null ? `${it.image_url}?v=${it.image_version}` : it.image_url}
                      alt={it.full_name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="font-display italic text-gold text-3xl sm:text-4xl">{it.brand[0]}</span>
                  )}
                </div>
                <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
                  <p className="text-[10px] sm:text-[11px] text-gold/80 uppercase tracking-wider truncate">{it.display_code ?? `PLT-${String(it.id).padStart(3, "0")}`}</p>
                  {(() => {
                    const g = genderBadge(it.gender);
                    return (
                      <span
                        title={`Género: ${g.label}`}
                        className={`shrink-0 inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-px rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide border ${g.classes}`}
                      >
                        <span className="text-[10px] sm:text-[11px] leading-none">{g.icon}</span>
                        <span className="hidden sm:inline">{g.label}</span>
                      </span>
                    );
                  })()}
                </div>
                <p className="font-display italic text-base sm:text-xl text-ink leading-tight mt-0.5 truncate">
                  {it.artistic_name ?? `Polianthes ${String(it.id).padStart(3, "0")}`}
                </p>
                {(it.inspired_by_name || it.inspired_by_brand) && (
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-ink-mute italic truncate">
                    Inspirado en {it.inspired_by_name ?? it.name}
                    {it.inspired_by_brand && ` · ${it.inspired_by_brand}`}
                  </p>
                )}
                {it.family && <p className="mt-0.5 text-[10px] sm:text-[11px] text-gold/70">{it.family}</p>}
                {it.min_price_cents !== null && it.min_price_cents > 0 && (
                  <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-ink/80">
                    Desde <span className="text-gold font-medium">${(it.min_price_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                  </p>
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3">
          {total > 0 && (
            <p className="text-xs sm:text-sm text-ink-mute">
              Mostrando <span className="text-ink">{visible.length}</span> de <span className="text-gold">{total}</span> fragancias
            </p>
          )}
          {hasMore && !family && (
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="liquid-glass rounded-full px-6 py-2.5 text-sm text-ink/90 hover:text-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
              aria-label="Cargar más fragancias"
            >
              {loadingMore ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                  Cargando…
                </>
              ) : (
                <>
                  Cargar más
                  <span className="text-gold/70">({Math.min(PAGE_SIZE, total - offset)})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

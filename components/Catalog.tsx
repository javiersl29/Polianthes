"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  image_url: string | null;
};

const FAMILIES = ["", "Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];

export default function Catalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [family, setFamily] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (note) params.set("note", note);
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
  }, [query, note, family]);

  const empty = useMemo(
    () => !loading && items.length === 0,
    [loading, items]
  );

  return (
    <section id="catalogo" className="relative py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <p className="text-sm text-ink-mute mb-4">// Catálogo</p>
            <h2 className="font-display italic text-ink text-5xl md:text-7xl leading-[0.9] tracking-[-3px]">
              La curaduría
            </h2>
          </div>
          <p className="text-ink-mute max-w-sm">
            Busca por nombre, marca o por una nota específica —ámbar, vetiver, oud, neroli— y deja que el
            buscador dinámico resalte las coincidencias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-8">
          <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o marca"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute"
            />
          </div>
          <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-gold text-sm">◎</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Buscar por nota: vainilla, vetiver, oud…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute"
            />
          </div>
          <div className="liquid-glass rounded-full px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
            {FAMILIES.map((f) => (
              <button
                key={f || "todas"}
                onClick={() => setFamily(f)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                  family === f ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
                }`}
              >
                {f || "Todas"}
              </button>
            ))}
          </div>
        </div>

        {empty && (
          <div className="liquid-glass rounded-3xl p-10 text-center text-ink-mute">
            <p className="font-display italic text-2xl text-ink">Sin coincidencias todavía</p>
            <p className="mt-2 text-sm">Prueba con otra nota o ajusta el nombre. Algunas fragancias aún no tienen notas documentadas.</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/fragancias/${it.slug}`}
              className="liquid-glass rounded-3xl p-4 hover:text-gold transition-colors"
            >
              <div className="aspect-[3/4] rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt={it.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display italic text-gold text-4xl">{it.brand[0]}</span>
                )}
              </div>
              <p className="mt-3 text-[11px] text-ink-mute uppercase tracking-wider">{it.brand}</p>
              <p className="font-display italic text-xl text-ink leading-tight">{it.name}</p>
              {it.family && <p className="mt-1 text-[11px] text-gold">{it.family}</p>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

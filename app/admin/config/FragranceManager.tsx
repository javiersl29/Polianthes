"use client";
import { useEffect, useState } from "react";

type Row = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  description: string | null;
  image_url: string | null;
  inspiration_image_url: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  active: boolean;
  enriched_at: string | null;
};

export default function FragranceManager() {
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/fragrances").then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setItems(data.items);
      }
    });
  }, []);

  const visible = items.filter((i) =>
    !filter || i.full_name.toLowerCase().includes(filter.toLowerCase())
  );

  const save = async (row: Row) => {
    await fetch("/api/admin/fragrances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
  };

  const enrich = async (slug: string) => {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug })
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...data.fragrance, enriched_at: new Date().toISOString() } : p)));
    }
  };

  const updateRow = (id: number, patch: Partial<Row>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <section className="mt-12">
      <h2 className="font-display italic text-3xl text-ink">Fragancias ({items.length})</h2>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por nombre"
        className="mt-4 liquid-glass rounded-full w-full px-4 py-2 bg-transparent outline-none text-sm"
      />
      <div className="mt-6 space-y-2">
        {visible.map((row) => (
          <div key={row.id} className="liquid-glass rounded-2xl p-4">
            <button
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-mute">{row.brand}</p>
                <p className="font-display italic text-xl text-ink">{row.name}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-mute">
                {row.enriched_at ? <span className="text-gold">Enriquecida</span> : <span>Sin enriquecer</span>}
                <span className="liquid-glass rounded-full px-3 py-1">{row.active ? "Activa" : "Inactiva"}</span>
              </div>
            </button>
            {expanded === row.id && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Field label="Descripción" value={row.description ?? ""} onChange={(v) => updateRow(row.id, { description: v })} />
                <Field label="Familia" value={row.family ?? ""} onChange={(v) => updateRow(row.id, { family: v })} />
                <Field label="Mood" value={row.mood ?? ""} onChange={(v) => updateRow(row.id, { mood: v })} />
                <Field label="Imagen URL" value={row.image_url ?? ""} onChange={(v) => updateRow(row.id, { image_url: v })} />
                <Field label="Imagen inspiración" value={row.inspiration_image_url ?? ""} onChange={(v) => updateRow(row.id, { inspiration_image_url: v })} />
                <Field label="Notas de salida (coma)" value={row.top_notes.join(", ")} onChange={(v) => updateRow(row.id, { top_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <Field label="Notas de corazón" value={row.heart_notes.join(", ")} onChange={(v) => updateRow(row.id, { heart_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <Field label="Notas de fondo" value={row.base_notes.join(", ")} onChange={(v) => updateRow(row.id, { base_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <label className="flex items-center gap-2 text-xs text-ink-mute">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => updateRow(row.id, { active: e.target.checked })}
                  />
                  Activa en el catálogo
                </label>
                <div className="md:col-span-2 flex items-center gap-3">
                  <button
                    onClick={() => save(row)}
                    className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold"
                  >
                    Guardar cambios
                  </button>
                  <button
                    onClick={() => enrich(row.slug)}
                    className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold"
                  >
                    Enriquecer con IA
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border-b border-line py-1.5 outline-none focus:border-gold"
      />
    </label>
  );
}

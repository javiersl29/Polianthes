"use client";
import { useEffect, useState } from "react";

type Gender = "hombre" | "mujer" | "unisex";
type Row = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  description: string | null;
  image_url: string | null;
  inspiration_image_url: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  active: boolean;
  enriched_at: string | null;
};

const FAMILIES = ["Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];
const GENDERS: Gender[] = ["hombre", "mujer", "unisex"];

export default function FragranceManager() {
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; updated: number; failed: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; enriched: number } | null>(null);

  const refresh = async () => {
    const [fr, st] = await Promise.all([
      fetch("/api/admin/fragrances"),
      fetch("/api/admin/enrich-batch")
    ]);
    if (fr.ok) {
      const data = await fr.json();
      setItems(data.items);
    }
    if (st.ok) {
      const data = await st.json();
      setStats(data);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const visible = items.filter((i) => (showInactive || i.active) && (!filter || i.full_name.toLowerCase().includes(filter.toLowerCase())));

  const save = async (row: Row) => {
    await fetch("/api/admin/fragrances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
  };

  const enrichOne = async (slug: string) => {
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

  const fetchImage = async (slug: string) => {
    const res = await fetch("/api/admin/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug })
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, image_url: data.image_url } : p)));
    } else {
      const err = await res.json();
      alert(err.error ?? "No se pudo obtener imagen");
    }
  };

  const uploadImage = async (slug: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, dataUrl })
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, image_url: data.image_url } : p)));
      } else {
        const err = await res.json();
        alert(err.error ?? "Error al subir");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateRow = (id: number, patch: Partial<Row>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const runBatch = async (mode: "pending" | "all") => {
    setBatchRunning(true);
    setBatchError(null);
    setBatchProgress(null);
    try {
      let totalUpdated = 0;
      let totalFailed = 0;
      let totalProcessed = 0;
      // Bucle de hasta 10 iteraciones de 20 fragancias
      for (let i = 0; i < 10; i += 1) {
        const res = await fetch("/api/admin/enrich-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, limit: 20 })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error en batch");
        }
        const data = await res.json();
        totalProcessed += data.processed;
        totalUpdated += data.updated;
        totalFailed += data.failed;
        setBatchProgress({ processed: totalProcessed, updated: totalUpdated, failed: totalFailed });
        if (data.processed < 20) break;
      }
      await refresh();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Error");
    } finally {
      setBatchRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-ink-mute">// Catálogo</p>
          <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Fragancias</h1>
          {stats && (
            <p className="mt-2 text-sm text-ink-mute">
              {stats.total} en total · {stats.enriched} documentadas con IA
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runBatch("pending")}
            disabled={batchRunning}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            {batchRunning ? "Enriqueciendo…" : "Enriquecer pendientes"}
          </button>
          <button
            onClick={() => runBatch("all")}
            disabled={batchRunning}
            className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            Re-enriquecer todo
          </button>
        </div>
      </div>

      {batchProgress && (
        <p className="mt-3 text-xs text-ink-mute">
          Procesadas {batchProgress.processed} · actualizadas {batchProgress.updated} · fallidas {batchProgress.failed}
        </p>
      )}
      {batchError && <p className="mt-3 text-xs text-rose-300">{batchError}</p>}

      <div className="mt-6 liquid-glass rounded-2xl p-4 text-xs text-ink-mute leading-relaxed">
        <p className="text-ink font-medium mb-1">Cómo funciona la búsqueda de imágenes</p>
        <p>
          El botón "Buscar en Pexels" consulta la API de Pexels (necesita <code className="text-gold">PEXELS_API_KEY</code> en
          Variables del servicio en Railway). Si no tienes la key, usa "Subir imagen" para arrastrar una foto
          desde tu equipo. La imagen se guarda en <code className="text-gold">/public/fragancias/</code> y se asigna
          automáticamente a la fragancia.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre o marca"
          className="liquid-glass rounded-full flex-1 min-w-[220px] px-4 py-2 bg-transparent outline-none text-sm"
        />
        <label className="liquid-glass rounded-full px-4 py-2 text-xs flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inactivas
        </label>
      </div>

      <div className="mt-6 space-y-2">
        {visible.map((row) => (
          <div key={row.id} className={`liquid-glass rounded-2xl p-4 ${!row.active ? "opacity-60" : ""}`}>
            <button
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-bg-elev grid place-items-center text-ink-mute text-sm">
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image_url} alt={row.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display italic text-gold">{row.brand[0]}</span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-ink-mute">{row.brand}</p>
                  <p className="font-display italic text-xl text-ink">{row.name}</p>
                </div>
              </div>
                <div className="flex items-center gap-2 text-xs text-ink-mute">
                  <span className="liquid-glass rounded-full px-3 py-1 capitalize">{row.gender}</span>
                  {row.enriched_at ? <span className="text-gold">Documentada</span> : <span>Sin documentar</span>}
                  <span className="liquid-glass rounded-full px-3 py-1">{row.active ? "Activa" : "Baja"}</span>
                </div>
            </button>
            {expanded === row.id && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Field label="Descripción" value={row.description ?? ""} onChange={(v) => updateRow(row.id, { description: v })} />
                <SelectField
                  label="Familia"
                  value={row.family ?? ""}
                  options={FAMILIES}
                  onChange={(v) => updateRow(row.id, { family: v || null })}
                />
                <SelectField
                  label="Género"
                  value={row.gender}
                  options={GENDERS}
                  onChange={(v) => updateRow(row.id, { gender: (v as Gender) || "unisex" })}
                />
                <Field label="Mood" value={row.mood ?? ""} onChange={(v) => updateRow(row.id, { mood: v })} />
                <Field label="URL imagen" value={row.image_url ?? ""} onChange={(v) => updateRow(row.id, { image_url: v })} />
                <Field label="URL imagen inspiración" value={row.inspiration_image_url ?? ""} onChange={(v) => updateRow(row.id, { inspiration_image_url: v })} />
                <Field label="Notas de salida (coma)" value={row.top_notes.join(", ")} onChange={(v) => updateRow(row.id, { top_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <Field label="Notas de corazón" value={row.heart_notes.join(", ")} onChange={(v) => updateRow(row.id, { heart_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <Field label="Notas de fondo" value={row.base_notes.join(", ")} onChange={(v) => updateRow(row.id, { base_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <label className="flex items-center gap-2 text-xs text-ink-mute">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => updateRow(row.id, { active: e.target.checked })}
                  />
                  Activa en el catálogo (dar de baja desmarcando)
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <button onClick={() => save(row)} className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold">
                    Guardar
                  </button>
                  <button onClick={() => enrichOne(row.slug)} className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold">
                    Documentar con IA
                  </button>
                  <button onClick={() => fetchImage(row.slug)} className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold">
                    Buscar en Pexels
                  </button>
                  <label className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold cursor-pointer">
                    Subir imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(row.slug, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
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

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-bg-elev border-b border-line py-1.5 outline-none focus:border-gold"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

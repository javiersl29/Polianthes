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

type PerfStatus = "idle" | "running" | "done" | "error";

const FAMILIES = ["Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];
const GENDERS: Gender[] = ["hombre", "mujer", "unisex"];

export default function FragranceManager() {
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stats, setStats] = useState<{ total: number; enriched: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Record<number, PerfStatus>>({});
  const [statusDetail, setStatusDetail] = useState<Record<number, string>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number; updated: number; failed: number; current?: string } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

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

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((v) => next.add(v.id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const save = async (row: Row) => {
    await fetch("/api/admin/fragrances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
  };

  const enrichOne = async (slug: string, id: number) => {
    setStatus((s) => ({ ...s, [id]: "running" }));
    setStatusDetail((d) => ({ ...d, [id]: "Llamando a la IA…" }));
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...data.fragrance, enriched_at: new Date().toISOString() } : p)));
        setStatus((s) => ({ ...s, [id]: "done" }));
        setStatusDetail((d) => ({ ...d, [id]: "Listo" }));
      } else {
        const err = await res.json();
        setStatus((s) => ({ ...s, [id]: "error" }));
        setStatusDetail((d) => ({ ...d, [id]: err.error ?? "Error" }));
      }
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: "error" }));
      setStatusDetail((d) => ({ ...d, [id]: err instanceof Error ? err.message : "Error" }));
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

  /**
   * Enriquece secuencialmente, una por una, actualizando el progreso en cada paso.
   * Si se le pasa una lista de slugs, procesa exactamente esa lista (modo selección).
   * Si no, procesa por lotes grandes desde el backend (modo masivo).
   */
  const enrichSequential = async (slugs: string[], ids: number[], label: string) => {
    setBatchRunning(true);
    setBatchError(null);
    setBatchProgress({ processed: 0, total: slugs.length, updated: 0, failed: 0 });
    const newStatus: Record<number, PerfStatus> = { ...status };
    const newDetail: Record<number, string> = { ...statusDetail };
    ids.forEach((id) => {
      newStatus[id] = "running";
      newDetail[id] = "En cola…";
    });
    setStatus(newStatus);
    setStatusDetail(newDetail);

    let updated = 0;
    let failed = 0;
    for (let i = 0; i < slugs.length; i += 1) {
      const slug = slugs[i];
      const id = ids[i];
      setStatus((s) => ({ ...s, [id]: "running" }));
      setStatusDetail((d) => ({ ...d, [id]: `${label} (${i + 1}/${slugs.length})` }));
      setBatchProgress({ processed: i, total: slugs.length, updated, failed, current: slug });
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug })
        });
        if (res.ok) {
          const data = await res.json();
          setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...data.fragrance, enriched_at: new Date().toISOString() } : p)));
          setStatus((s) => ({ ...s, [id]: "done" }));
          setStatusDetail((d) => ({ ...d, [id]: "Listo" }));
          updated += 1;
        } else {
          const err = await res.json().catch(() => ({}));
          setStatus((s) => ({ ...s, [id]: "error" }));
          setStatusDetail((d) => ({ ...d, [id]: err.error ?? `HTTP ${res.status}` }));
          failed += 1;
        }
      } catch (err) {
        setStatus((s) => ({ ...s, [id]: "error" }));
        setStatusDetail((d) => ({ ...d, [id]: err instanceof Error ? err.message : "Error" }));
        failed += 1;
      }
      setBatchProgress({ processed: i + 1, total: slugs.length, updated, failed, current: slug });
      // Pausa para no saturar la API
      await new Promise((r) => setTimeout(r, 300));
    }
    await refresh();
    setBatchRunning(false);
  };

  const runBatchPending = () => {
    const pending = items.filter((i) => !i.enriched_at);
    if (pending.length === 0) {
      setBatchError("No hay fragancias pendientes.");
      return;
    }
    enrichSequential(pending.map((p) => p.slug), pending.map((p) => p.id), "Documentando");
  };

  const runBatchAll = () => {
    if (items.length === 0) return;
    enrichSequential(items.map((p) => p.slug), items.map((p) => p.id), "Re-documentando");
  };

  const runSelection = (mode: "pending" | "all") => {
    const subset = items.filter((i) => selected.has(i.id));
    if (subset.length === 0) {
      setBatchError("Selecciona al menos una fragancia.");
      return;
    }
    const filtered = mode === "pending" ? subset.filter((i) => !i.enriched_at) : subset;
    if (filtered.length === 0) {
      setBatchError("La selección ya está documentada. Usa 'Re-documentar selección'.");
      return;
    }
    enrichSequential(
      filtered.map((p) => p.slug),
      filtered.map((p) => p.id),
      mode === "pending" ? "Documentando selección" : "Re-documentando selección"
    );
  };

  const percent = batchProgress ? Math.round((batchProgress.processed / Math.max(1, batchProgress.total)) * 100) : 0;

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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runBatchPending}
            disabled={batchRunning}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            {batchRunning ? "Trabajando…" : "Documentar pendientes"}
          </button>
          <button
            onClick={runBatchAll}
            disabled={batchRunning}
            className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            {batchRunning ? "Trabajando…" : "Re-documentar todo"}
          </button>
        </div>
      </div>

      {batchProgress && (
        <div className="mt-5 liquid-glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-ink-mute mb-2">
            <span>
              {batchProgress.processed} / {batchProgress.total} — {percent}%
              {batchProgress.current && (
                <span className="text-ink ml-2">→ {batchProgress.current}</span>
              )}
            </span>
            <span>
              <span className="text-gold">{batchProgress.updated} ok</span> · <span className="text-rose-300">{batchProgress.failed} error</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-bg-elev rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      {batchError && <p className="mt-3 text-xs text-rose-300">{batchError}</p>}

      {selected.size > 0 && !batchRunning && (
        <div className="mt-5 liquid-glass-strong rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm">
            <span className="text-gold font-medium">{selected.size}</span> fragancia{selected.size === 1 ? "" : "s"} seleccionada{selected.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => runSelection("pending")}
              className="liquid-glass-strong rounded-full px-3 py-1.5 text-xs hover:text-gold"
            >
              Documentar selección
            </button>
            <button
              onClick={() => runSelection("all")}
              className="liquid-glass rounded-full px-3 py-1.5 text-xs hover:text-gold"
            >
              Re-documentar selección
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-ink-mute hover:text-gold px-2"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

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
        <button
          onClick={selectAllVisible}
          className="liquid-glass rounded-full px-4 py-2 text-xs hover:text-gold"
        >
          Seleccionar visibles
        </button>
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
        {visible.map((row) => {
          const st = status[row.id] ?? "idle";
          return (
            <div
              key={row.id}
              className={`liquid-glass rounded-2xl p-4 ${!row.active ? "opacity-60" : ""} ${
                st === "running" ? "ring-1 ring-gold/60" : st === "done" ? "ring-1 ring-emerald-400/40" : st === "error" ? "ring-1 ring-rose-400/40" : ""
              }`}
            >
              <div className="w-full flex items-center gap-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggleSelected(row.id)}
                  className="h-4 w-4 accent-[color:var(--color-gold)]"
                  aria-label={`Seleccionar ${row.full_name}`}
                />
                <button
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-bg-elev grid place-items-center text-ink-mute text-sm shrink-0">
                      {row.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.image_url} alt={row.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display italic text-gold">{row.brand[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wider text-ink-mute truncate">{row.brand}</p>
                      <p className="font-display italic text-xl text-ink truncate">{row.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-mute shrink-0">
                    {st === "running" && <span className="liquid-glass rounded-full px-3 py-1 text-gold">Procesando…</span>}
                    {st === "done" && <span className="liquid-glass rounded-full px-3 py-1 text-emerald-300">Listo</span>}
                    {st === "error" && <span className="liquid-glass rounded-full px-3 py-1 text-rose-300" title={statusDetail[row.id]}>Error</span>}
                    <span className="liquid-glass rounded-full px-3 py-1 capitalize">{row.gender}</span>
                    {row.enriched_at ? <span className="text-gold">Documentada</span> : <span>Sin documentar</span>}
                    <span className="liquid-glass rounded-full px-3 py-1">{row.active ? "Activa" : "Baja"}</span>
                  </div>
                </button>
              </div>
              {st === "error" && statusDetail[row.id] && (
                <p className="mt-2 ml-7 text-xs text-rose-300">{statusDetail[row.id]}</p>
              )}
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
                    <button
                      onClick={() => enrichOne(row.slug, row.id)}
                      disabled={st === "running"}
                      className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
                    >
                      {st === "running" ? "Documentando…" : "Documentar con IA"}
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
          );
        })}
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

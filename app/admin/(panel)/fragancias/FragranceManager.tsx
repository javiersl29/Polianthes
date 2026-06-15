"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  vec_floral: number;
  vec_oriental: number;
  vec_amaderado: number;
  vec_chipre: number;
  vec_citrico: number;
  vec_gourmand: number;
  vec_frescura: number;
  vec_misterio: number;
  vec_romantico: number;
  vec_energia: number;
  vec_sofisticado: number;
  vec_nostalgico: number;
};

type PerfStatus = "idle" | "running" | "done" | "error";
type BatchState = "idle" | "running" | "paused" | "stopped";

const FAMILIES = ["Floral", "Oriental", "Amaderado", "Chipre", "Cítrico", "Gourmand"];
const GENDERS: Gender[] = ["hombre", "mujer", "unisex"];

const FAMILY_VEC_KEYS = [
  ["Floral", "vec_floral"],
  ["Oriental", "vec_oriental"],
  ["Amaderado", "vec_amaderado"],
  ["Chipre", "vec_chipre"],
  ["Cítrico", "vec_citrico"],
  ["Gourmand", "vec_gourmand"]
] as const;
const MOOD_VEC_KEYS = [
  ["Frescura", "vec_frescura"],
  ["Misterio", "vec_misterio"],
  ["Romántico", "vec_romantico"],
  ["Energía", "vec_energia"],
  ["Sofisticado", "vec_sofisticado"],
  ["Nostálgico", "vec_nostalgico"]
] as const;

export default function FragranceManager() {
  const [items, setItems] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stats, setStats] = useState<{ total: number; enriched: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Record<number, PerfStatus>>({});
  const [statusDetail, setStatusDetail] = useState<Record<number, string>>({});
  const [batchState, setBatchState] = useState<BatchState>("idle");
  const [batchProgress, setBatchProgress] = useState<{
    processed: number;
    total: number;
    updated: number;
    failed: number;
    current?: string;
  } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Estado del modal de alta
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    full_name: string;
    family: string;
    mood: string;
    gender: Gender;
  }>({ full_name: "", family: "", mood: "", gender: "unisex" });
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado de generación de imagen
  const [generatingImage, setGeneratingImage] = useState<Record<number, boolean>>({});
  const [generatedPreview, setGeneratedPreview] = useState<Record<number, string | null>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [findingRef, setFindingRef] = useState<Record<number, boolean>>({});

  // Refs para pausar/detener
  const pausedRef = useRef(false);
  const stoppedRef = useRef(false);

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

  const visible = items.filter(
    (i) => (showInactive || i.active) && (!filter || i.full_name.toLowerCase().includes(filter.toLowerCase()))
  );

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
    setSavingId(row.id);
    try {
      const res = await fetch("/api/admin/fragrances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      toast.success(`${row.brand} · ${row.name} guardado correctamente`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingId(null);
    }
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
        const frag = data.fragrance ?? {};
        const fa = frag.family_axes ?? {};
        const ma = frag.mood_axes ?? {};
        const patch: Partial<Row> = {
          description: frag.description ?? null,
          family: frag.family ?? null,
          mood: frag.mood ?? null,
          gender: (frag.gender as Gender) ?? "unisex",
          top_notes: frag.top_notes ?? [],
          heart_notes: frag.heart_notes ?? [],
          base_notes: frag.base_notes ?? [],
          enriched_at: new Date().toISOString(),
          vec_floral: fa.floral ?? 50,
          vec_oriental: fa.oriental ?? 50,
          vec_amaderado: fa.amaderado ?? 50,
          vec_chipre: fa.chipre ?? 50,
          vec_citrico: fa.citrico ?? 50,
          vec_gourmand: fa.gourmand ?? 50,
          vec_frescura: ma.frescura ?? 50,
          vec_misterio: ma.misterio ?? 50,
          vec_romantico: ma.romantico ?? 50,
          vec_energia: ma.energia ?? 50,
          vec_sofisticado: ma.sofisticado ?? 50,
          vec_nostalgico: ma.nostalgico ?? 50
        };
        setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
        const provider = frag.search_provider ?? "ninguno";
        const fallback = frag.used_fallback ? " (fallback aplicado)" : "";
        setStatus((s) => ({ ...s, [id]: "done" }));
        setStatusDetail((d) => ({ ...d, [id]: `Listo · búsqueda: ${provider}${fallback}` }));
        toast.success(`Documentado con IA correctamente`);
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

  function splitBrandClient(full: string) {
    const idx = full.indexOf(" - ");
    if (idx === -1) return { brand: "Independiente", name: full };
    return { brand: full.slice(0, idx).trim(), name: full.slice(idx + 3).trim() };
  }

  const generateAiImage = async (row: Row) => {
    setGeneratingImage((g) => ({ ...g, [row.id]: true }));
    try {
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: row.slug, save: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.reason === "no_provider") {
        toast.error(data.message || "La API de imágenes no está disponible.");
        return;
      }
      setGeneratedPreview((p) => ({ ...p, [row.id]: data.url ?? null }));
      toast.success("Imagen generada. Revisa la preview abajo y decide si guardarla.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGeneratingImage((g) => ({ ...g, [row.id]: false }));
    }
  };

  const acceptAiImage = async (row: Row) => {
    const preview = generatedPreview[row.id];
    if (!preview) return;
    try {
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: row.slug, save: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, image_url: data.image_url } : p)));
      setGeneratedPreview((p) => ({ ...p, [row.id]: null }));
      toast.success("Imagen guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const rejectAiImage = (row: Row): void => {
    setGeneratedPreview((p) => ({ ...p, [row.id]: null }));
  };

  const findReference = async (row: Row) => {
    setFindingRef((f) => ({ ...f, [row.id]: true }));
    try {
      const res = await fetch("/api/admin/fragrances/find-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: row.slug,
          persist: true,
          refetch_count: 0,
          gender: row.gender ?? null
        })
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.message || "No se encontró imagen de referencia");
        return;
      }
      toast.success(`Referencia encontrada: ${data.reference?.source ?? "ok"}`);
      // Recargar items para mostrar la referencia actualizada
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al buscar referencia");
    } finally {
      setFindingRef((f) => ({ ...f, [row.id]: false }));
    }
  };

  const uploadImage = async (slug: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      try {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, dataUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al subir");
        setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, image_url: data.image_url } : p)));
        toast.success("Imagen subida correctamente");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateRow = (id: number, patch: Partial<Row>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  /**
   * Enriquece secuencialmente, una por una.
   * Soporta pausar (espera en el siguiente paso) y detener (sale del bucle).
   */
  const enrichSequential = async (slugs: string[], ids: number[], label: string) => {
    setBatchState("running");
    setBatchError(null);
    setBatchProgress({ processed: 0, total: slugs.length, updated: 0, failed: 0 });
    pausedRef.current = false;
    stoppedRef.current = false;

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
      if (stoppedRef.current) break;

      // Pausa: esperar a que se reanude
      while (pausedRef.current && !stoppedRef.current) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (stoppedRef.current) break;

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
          const frag = data.fragrance ?? {};
          const fa = frag.family_axes ?? {};
          const ma = frag.mood_axes ?? {};
          const patch: Partial<Row> = {
            description: frag.description ?? null,
            family: frag.family ?? null,
            mood: frag.mood ?? null,
            gender: (frag.gender as Gender) ?? "unisex",
            top_notes: frag.top_notes ?? [],
            heart_notes: frag.heart_notes ?? [],
            base_notes: frag.base_notes ?? [],
            enriched_at: new Date().toISOString(),
            vec_floral: fa.floral ?? 50,
            vec_oriental: fa.oriental ?? 50,
            vec_amaderado: fa.amaderado ?? 50,
            vec_chipre: fa.chipre ?? 50,
            vec_citrico: fa.citrico ?? 50,
            vec_gourmand: fa.gourmand ?? 50,
            vec_frescura: ma.frescura ?? 50,
            vec_misterio: ma.misterio ?? 50,
            vec_romantico: ma.romantico ?? 50,
            vec_energia: ma.energia ?? 50,
            vec_sofisticado: ma.sofisticado ?? 50,
            vec_nostalgico: ma.nostalgico ?? 50
          };
          setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
          const tag = frag.used_fallback ? " (fallback)" : "";
          setStatus((s) => ({ ...s, [id]: "done" }));
          setStatusDetail((d) => ({ ...d, [id]: `Listo${tag}` }));
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
      await new Promise((r) => setTimeout(r, 300));
    }
    await refresh();
    if (stoppedRef.current) {
      setBatchState("stopped");
      setBatchError(`Detenido por el usuario tras ${updated} procesadas.`);
    } else {
      setBatchState("idle");
    }
  };

  const pauseBatch = () => {
    if (batchState !== "running") return;
    pausedRef.current = true;
    setBatchState("paused");
  };
  const resumeBatch = () => {
    if (batchState !== "paused") return;
    pausedRef.current = false;
    setBatchState("running");
  };
  const stopBatch = () => {
    stoppedRef.current = true;
    pausedRef.current = false;
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

  const submitCreate = async () => {
    setCreateError(null);
    const fullName = createForm.full_name.trim();
    if (!fullName) {
      setCreateError("Indica el nombre completo de la fragancia");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/fragrances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          family: createForm.family || null,
          mood: createForm.mood || null,
          gender: createForm.gender,
          create_presentations: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const { brand, name } = splitBrandClient(fullName);
      toast.success(`Alta: ${brand} · ${name}`, {
        description: `SKU ${data.fragrance.display_code} · 4 presentaciones creadas con precios por defecto.`
      });
      setCreateForm({ full_name: "", family: "", mood: "", gender: "unisex" });
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  const deleteFragrance = async (row: Row, hard: boolean) => {
    const msg = hard
      ? `¿Eliminar DEFINITIVAMENTE "${row.full_name}"? Esta acción no se puede deshacer. Las presentaciones también se borrarán.`
      : `¿Dar de baja "${row.full_name}"? Dejará de aparecer en el catálogo público pero se conserva el historial.`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch("/api/admin/fragrances", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, hard })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(hard ? "Fragrancia eliminada" : "Fragrancia dada de baja");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const reactivateFragrance = async (row: Row) => {
    try {
      const res = await fetch("/api/admin/fragrances", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success("Fragrancia reactivada");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
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
            onClick={() => {
              setCreateError(null);
              setCreateForm({ full_name: "", family: "", mood: "", gender: "unisex" });
            }}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold"
            data-toggle="new-fragrance"
          >
            + Nueva fragancia
          </button>
          <button
            onClick={runBatchPending}
            disabled={batchState === "running" || batchState === "paused"}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            Documentar pendientes
          </button>
          <button
            onClick={runBatchAll}
            disabled={batchState === "running" || batchState === "paused"}
            className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
          >
            Re-documentar todo
          </button>
          {batchState === "running" && (
            <button
              onClick={pauseBatch}
              className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold"
            >
              Pausar
            </button>
          )}
          {batchState === "paused" && (
            <button
              onClick={resumeBatch}
              className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold"
            >
              Reanudar
            </button>
          )}
          {(batchState === "running" || batchState === "paused") && (
            <button
              onClick={stopBatch}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-rose-300 hover:text-rose-200"
            >
              Detener
            </button>
          )}
        </div>
      </div>

      {batchProgress && (
        <div className="mt-5 liquid-glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-ink-mute mb-2">
            <span>
              {batchProgress.processed} / {batchProgress.total} — {percent}%
              {batchState === "paused" && <span className="text-gold ml-2">(pausado)</span>}
              {batchProgress.current && batchState === "running" && (
                <span className="text-ink ml-2">→ {batchProgress.current}</span>
              )}
            </span>
            <span>
              <span className="text-gold">{batchProgress.updated} ok</span> · <span className="text-rose-300">{batchProgress.failed} error</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-bg-elev rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${batchState === "paused" ? "bg-ink-mute" : "bg-gold"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      {batchError && <p className="mt-3 text-xs text-rose-300">{batchError}</p>}

      {selected.size > 0 && batchState === "idle" && (
        <div className="mt-5 liquid-glass-strong rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm">
            <span className="text-gold font-medium">{selected.size}</span> fragancia{selected.size === 1 ? "" : "s"} seleccionada{selected.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => runSelection("pending")} className="liquid-glass-strong rounded-full px-3 py-1.5 text-xs hover:text-gold">
              Documentar selección
            </button>
            <button onClick={() => runSelection("all")} className="liquid-glass rounded-full px-3 py-1.5 text-xs hover:text-gold">
              Re-documentar selección
            </button>
            <button onClick={clearSelection} className="text-xs text-ink-mute hover:text-gold px-2">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 liquid-glass rounded-2xl p-4 text-xs text-ink-mute leading-relaxed">
        <p className="text-ink font-medium mb-1">Vectores numéricos</p>
        <p>
          Cada fragancia almacena 12 valores 0-100 que puntúan su composición real (familias y mood).
          El decodificador los usa para un ranking numérico objetivo antes de pedir a la IA que
          seleccione 5 con justificación. Puedes ajustar los sliders a mano en cada fragancia.
        </p>
      </div>

      <div className="mt-6 liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display italic text-lg sm:text-xl text-ink">Dar de alta una fragancia</h2>
            <p className="text-[11px] text-ink-mute mt-0.5">
              Crea el registro y 4 presentaciones (10/30/60/100 ml) con precios por defecto. Luego podrás documentarla con IA.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-mute">Nombre completo *</span>
            <input
              value={createForm.full_name}
              onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Paco Rabanne - One Million"
              className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) submitCreate();
              }}
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-mute">Familia</span>
            <select
              value={createForm.family}
              onChange={(e) => setCreateForm((f) => ({ ...f, family: e.target.value }))}
              className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            >
              <option value="">—</option>
              {FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-mute">Mood</span>
            <input
              value={createForm.mood}
              onChange={(e) => setCreateForm((f) => ({ ...f, mood: e.target.value }))}
              placeholder="ej. Misterioso"
              className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-mute">Género</span>
            <select
              value={createForm.gender}
              onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value as Gender }))}
              className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
            >
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <button
            onClick={submitCreate}
            disabled={creating}
            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? "Creando…" : "Dar de alta"}
          </button>
        </div>
        {createError && <p className="text-xs text-rose-300">{createError}</p>}
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
          disabled={batchState === "running" || batchState === "paused"}
          className="liquid-glass rounded-full px-4 py-2 text-xs hover:text-gold disabled:opacity-50"
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
                st === "running"
                  ? "ring-1 ring-gold/60"
                  : st === "done"
                  ? "ring-1 ring-emerald-400/40"
                  : st === "error"
                  ? "ring-1 ring-rose-400/40"
                  : ""
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
                    {st === "error" && (
                      <span className="liquid-glass rounded-full px-3 py-1 text-rose-300" title={statusDetail[row.id]}>
                        Error
                      </span>
                    )}
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
                  <Field
                    label="Notas de salida (coma)"
                    value={row.top_notes.join(", ")}
                    onChange={(v) => updateRow(row.id, { top_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                  <Field
                    label="Notas de corazón"
                    value={row.heart_notes.join(", ")}
                    onChange={(v) => updateRow(row.id, { heart_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                  <Field
                    label="Notas de fondo"
                    value={row.base_notes.join(", ")}
                    onChange={(v) => updateRow(row.id, { base_notes: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                  <label className="flex items-center gap-2 text-xs text-ink-mute">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) => updateRow(row.id, { active: e.target.checked })}
                    />
                    Activa en el catálogo (dar de baja desmarcando)
                  </label>

                  <div className="md:col-span-2 mt-2">
                    <p className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Vector de familias (0-100)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FAMILY_VEC_KEYS.map(([label, key]) => (
                        <VectorSlider
                          key={key}
                          label={label}
                          value={row[key as keyof Row] as number}
                          onChange={(v) => updateRow(row.id, { [key]: v } as Partial<Row>)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Vector de mood (0-100)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MOOD_VEC_KEYS.map(([label, key]) => (
                        <VectorSlider
                          key={key}
                          label={label}
                          value={row[key as keyof Row] as number}
                          onChange={(v) => updateRow(row.id, { [key]: v } as Partial<Row>)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => save(row)}
                      disabled={savingId === row.id}
                      className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {savingId === row.id ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                          Guardando…
                        </>
                      ) : (
                        "Guardar"
                      )}
                    </button>
                    <button
                      onClick={() => enrichOne(row.slug, row.id)}
                      disabled={st === "running"}
                      className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
                    >
                      {st === "running" ? "Documentando…" : "Documentar con IA"}
                    </button>
                    <button
                      onClick={() => findReference(row)}
                      disabled={findingRef[row.id]}
                      className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50 inline-flex items-center gap-2"
                      title="Busca la imagen del perfume original con Serper (Google Images)"
                    >
                      {findingRef[row.id] ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                          Buscando…
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                          </svg>
                          Buscar referencia
                        </>
                      )}
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
                    <button
                      onClick={() => generateAiImage(row)}
                      disabled={generatingImage[row.id]}
                      className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
                      title="Genera una imagen con IA (MiniMax) usando el template de marca"
                    >
                      {generatingImage[row.id] ? "Generando…" : "✦ Generar con IA"}
                    </button>
                    {row.active ? (
                      <button
                        onClick={() => deleteFragrance(row, false)}
                        className="liquid-glass rounded-full px-4 py-2 text-sm text-ink-mute hover:text-rose-300 ml-auto"
                      >
                        Dar de baja
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateFragrance(row)}
                        className="liquid-glass rounded-full px-4 py-2 text-sm text-emerald-300 hover:text-emerald-200 ml-auto"
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      onClick={() => deleteFragrance(row, true)}
                      className="text-ink-mute/60 hover:text-rose-400 text-xs px-2"
                      title="Eliminar definitivamente"
                    >
                      × Eliminar
                    </button>
                  </div>

                  {generatedPreview[row.id] && (
                    <div className="md:col-span-2 mt-3 liquid-glass-strong rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-ink-mute">
                        Vista previa generada por IA. Si te gusta, guárdala. Si no, descarta y vuelve a generar.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="w-32 sm:w-40 aspect-square rounded-xl overflow-hidden bg-bg-elev shrink-0">
                          <img src={generatedPreview[row.id]!} alt="Preview IA" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => acceptAiImage(row)}
                            className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold"
                          >
                            Guardar como imagen oficial
                          </button>
                          <button
                            onClick={() => rejectAiImage(row)}
                            className="liquid-glass rounded-full px-4 py-2 text-sm text-ink-mute hover:text-rose-300"
                          >
                            Descartar y regenerar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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

function VectorSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="liquid-glass rounded-2xl px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs">{label}</span>
        <span className="font-display italic text-gold text-base">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[color:var(--color-gold)]"
        aria-label={label}
      />
    </div>
  );
}

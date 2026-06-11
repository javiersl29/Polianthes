"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Item = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  display_code: string | null;
  artistic_name: string | null;
  image_url: string | null;
  family: string | null;
  mood: string | null;
};

type Preview = {
  id: number;
  slug: string;
  status: "idle" | "generating" | "ready" | "error";
  url: string | null;
  message?: string;
};

const MAX_SELECTION = 10;

export default function ImagesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [diag, setDiag] = useState<{ config: Record<string, unknown>; ping: Record<string, unknown> } | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/fragrances")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/admin/fragrances/generate-image")
      .then((r) => r.json())
      .then((data) => setDiag(data))
      .catch(() => setDiag(null));
  }, []);

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= MAX_SELECTION) {
          toast.error(`Máximo ${MAX_SELECTION} fragancias a la vez`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const generateOne = async (row: Item): Promise<Preview> => {
    setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "generating", url: null } }));
    try {
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: row.slug, save: false })
      });
      const data = await res.json();
      if (data?.reason === "generation_failed" || data?.reason === "no_url") {
        const lines = [
          data.message,
          data.endpoint ? `endpoint: ${data.endpoint}` : "",
          data.model ? `modelo: ${data.model}` : ""
        ].filter(Boolean);
        const msg = lines.join(" · ");
        setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", url: null, message: msg } }));
        return { id: row.id, slug: row.slug, status: "error", url: null, message: msg };
      }
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.reason === "no_provider") {
        const msg = data.message || "API de imágenes no configurada";
        setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", url: null, message: msg } }));
        return { id: row.id, slug: row.slug, status: "error", url: null, message: msg };
      }
      setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "ready", url: data.url } }));
      return { id: row.id, slug: row.slug, status: "ready", url: data.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", url: null, message: msg } }));
      return { id: row.id, slug: row.slug, status: "error", url: null, message: msg };
    }
  };

  const runBatch = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos una fragancia");
      return;
    }
    setBatchRunning(true);
    const targets = items.filter((i) => selected.has(i.id));
    for (const row of targets) {
      await generateOne(row);
      await new Promise((r) => setTimeout(r, 300));
    }
    setBatchRunning(false);
    toast.success("Generación completa. Revisa las previews y decide qué guardar.");
  };

  const acceptOne = async (row: Item) => {
    const preview = previews[row.id];
    if (!preview || preview.status !== "ready") return;
    try {
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: row.slug, save: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, image_url: data.image_url } : p)));
      setPreviews((p) => ({ ...p, [row.id]: { ...p[row.id]!, status: "idle", url: null } }));
      toast.success(`${row.full_name} → imagen guardada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const acceptAll = async () => {
    const ready = selectedIds(items, previews);
    if (ready.length === 0) {
      toast.error("No hay previews listas para guardar");
      return;
    }
    for (const id of ready) {
      const row = items.find((i) => i.id === id);
      if (row) await acceptOne(row);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  const filtered = items.filter(
    (i) =>
      !search.trim() ||
      i.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.artistic_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.display_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = selected.size;
  const readyCount = selectedIds(items, previews).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display italic text-2xl sm:text-3xl text-ink">Imágenes con IA</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Genera imágenes con plantilla de marca (silueta de frasco + fondo negro + luz dorada + perfume original difuminado al fondo). Selecciona hasta {MAX_SELECTION} fragancias, previsualiza, y guarda las que te gusten.
        </p>
      </div>

      {diag && <DiagPanel diag={diag} open={diagOpen} setOpen={setDiagOpen} />}

      <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 block">
            <span className="text-[10px] uppercase tracking-wider text-ink-mute">Buscar fragancia</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, marca, código…"
              className="mt-1 w-full liquid-glass rounded-full px-3 sm:px-4 py-2 text-sm bg-transparent outline-none placeholder:text-ink-mute"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={runBatch}
              disabled={batchRunning || selectedCount === 0}
              className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {batchRunning ? "Generando…" : `Generar ${selectedCount || ""} previews`}
            </button>
            {readyCount > 0 && (
              <button
                onClick={acceptAll}
                className="liquid-glass rounded-full px-4 py-2 text-sm text-gold hover:text-gold/80"
              >
                Guardar todas ({readyCount})
              </button>
            )}
            <button
              onClick={clearSelection}
              disabled={selectedCount === 0}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-ink-mute hover:text-gold disabled:opacity-50"
            >
              Limpiar
            </button>
          </div>
        </div>
        <p className="text-[11px] text-ink-mute">
          {selectedCount}/{MAX_SELECTION} seleccionadas
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-mute">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((row) => {
            const isSelected = selected.has(row.id);
            const preview = previews[row.id];
            return (
              <div
                key={row.id}
                className={`liquid-glass rounded-2xl overflow-hidden flex flex-col ${
                  isSelected ? "ring-1 ring-gold/60" : ""
                }`}
              >
                <label className="flex items-start gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(row.id)}
                    className="mt-1 h-4 w-4 accent-[color:var(--color-gold)]"
                    disabled={!isSelected && selectedCount >= MAX_SELECTION}
                    aria-label={`Seleccionar ${row.full_name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gold/80 uppercase tracking-wider truncate">{row.display_code ?? `PLT-${String(row.id).padStart(3, "0")}`}</p>
                    <p className="font-display italic text-sm text-ink truncate">
                      {row.artistic_name ?? row.name}
                    </p>
                    <p className="text-[10px] text-ink-mute truncate">{row.brand}</p>
                  </div>
                </label>
                <div className="aspect-square bg-bg-elev/40 grid place-items-center text-xs text-ink-mute">
                  {preview?.status === "ready" && preview.url ? (
                    <img src={preview.url} alt={`Preview IA de ${row.full_name}`} className="w-full h-full object-cover" />
                  ) : preview?.status === "generating" ? (
                    <span className="text-gold">Generando…</span>
                  ) : preview?.status === "error" ? (
                    <span className="text-rose-300 px-3 text-center">{preview.message || "Error"}</span>
                  ) : row.image_url ? (
                    <img src={row.image_url} alt={row.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span>Sin imagen</span>
                  )}
                </div>
                {preview?.status === "ready" && (
                  <div className="p-2 flex gap-2">
                    <button
                      onClick={() => acceptOne(row)}
                      className="flex-1 liquid-glass-strong rounded-full px-3 py-1.5 text-xs hover:text-gold"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => generateOne(row)}
                      disabled={batchRunning}
                      className="flex-1 liquid-glass rounded-full px-3 py-1.5 text-xs hover:text-gold"
                    >
                      Regenerar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function selectedIds(items: Item[], previews: Record<number, Preview>): number[] {
  return items.filter((i) => previews[i.id]?.status === "ready").map((i) => i.id);
}

function DiagPanel({ diag, open, setOpen }: { diag: { config: Record<string, unknown>; ping: Record<string, unknown> }; open: boolean; setOpen: (v: boolean) => void }) {
  const resolved = (diag.config.resolved as { endpoint?: string; model?: string; source?: string } | null) ?? null;
  const ping = diag.ping;
  const pingOk = Boolean(ping.ok);
  return (
    <div className="liquid-glass rounded-2xl p-3 sm:p-4 text-xs space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-ink-mute hover:text-gold w-full text-left"
      >
        <span className={`h-2 w-2 rounded-full ${pingOk ? "bg-emerald-400" : "bg-rose-400"}`} />
        <span className="font-medium">
          {pingOk ? "Conectividad con el proveedor de imágenes OK" : "Sin conectividad — revisa la configuración"}
        </span>
        <span className="ml-auto text-[10px] text-ink-mute/60">{open ? "ocultar" : "diagnóstico"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[11px] text-ink-mute leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="text-ink-mute/60">Endpoint usado:</span> <code className="text-ink">{resolved?.endpoint ?? "(no resuelto)"}</code></div>
            <div><span className="text-ink-mute/60">Modelo:</span> <code className="text-ink">{resolved?.model ?? "—"}</code></div>
            <div><span className="text-ink-mute/60">Origen config:</span> <code className="text-ink">{resolved?.source ?? "—"}</code></div>
            <div><span className="text-ink-mute/60">Ping status:</span> <code className="text-ink">{String(ping.status ?? "—")}</code></div>
          </div>
          <div className="pt-2 border-t border-line/30 space-y-1">
            <p className="text-ink/80 font-medium">Para configurar, define estas variables en Railway:</p>
            <pre className="bg-bg-elev/50 rounded-md p-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
{`MINIMAX_IMAGE_API_KEY=<tu-api-key-de-imagen>
MINIMAX_IMAGE_ENDPOINT=https://api.minimax.io/v1/image_generation
MINIMAX_IMAGE_MODEL=minimax-image-01`}
            </pre>
            <p className="text-[10px] text-ink-mute/80">
              Si tu base_url es distinto (ej. api.minimax.chat), ajusta MINIMAX_IMAGE_ENDPOINT. Si tu modelo se llama distinto (ej. minimax-image-1.0), cámbialo en MINIMAX_IMAGE_MODEL.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

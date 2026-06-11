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

type ImageConfig = {
  id: number;
  provider: string;
  endpoint: string;
  api_key: string | null;
  model: string;
  aspect_ratio: string;
  response_format: "url" | "base64";
  prompt_optimizer: boolean;
  n: number;
  active: boolean;
  updated_at: string;
};

type Diag = {
  has_db_config: boolean;
  db_config: ImageConfig | null;
  env_endpoint: string | null;
  env_model: string | null;
  has_env_key: boolean;
  resolved: { endpoint: string; model: string; source: string } | null;
};

type TestResult = {
  ok: boolean;
  endpoint: string;
  model: string;
  source: string;
  status_code?: number;
  status_msg?: string;
  image_count?: number;
  elapsed_ms?: number;
  error?: string;
};

const MAX_SELECTION = 10;
const ASPECT_RATIOS = ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"];

export default function ImagesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState<ImageConfig | null>(null);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [configForm, setConfigForm] = useState<{
    provider: string;
    endpoint: string;
    api_key: string;
    clear_api_key: boolean;
    model: string;
    aspect_ratio: string;
    response_format: "url" | "base64";
    prompt_optimizer: boolean;
    n: number;
    active: boolean;
  }>({
    provider: "minimax",
    endpoint: "https://api.minimax.io/v1/image_generation",
    api_key: "",
    clear_api_key: false,
    model: "image-01",
    aspect_ratio: "1:1",
    response_format: "url",
    prompt_optimizer: false,
    n: 1,
    active: true
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const loadAll = async () => {
    try {
      const [fr, cfg, di] = await Promise.all([
        fetch("/api/admin/fragrances").then((r) => r.json()),
        fetch("/api/admin/image-config").then((r) => r.json()),
        fetch("/api/admin/fragrances/generate-image", { method: "GET" }).then((r) => r.json())
      ]);
      setItems(fr.items ?? []);
      setLoading(false);
      if (cfg.config) {
        setConfig(cfg.config);
        setConfigForm({
          provider: cfg.config.provider ?? "minimax",
          endpoint: cfg.config.endpoint ?? "https://api.minimax.io/v1/image_generation",
          api_key: "",
          clear_api_key: false,
          model: cfg.config.model ?? "image-01",
          aspect_ratio: cfg.config.aspect_ratio ?? "1:1",
          response_format: cfg.config.response_format ?? "url",
          prompt_optimizer: cfg.config.prompt_optimizer ?? false,
          n: cfg.config.n ?? 1,
          active: cfg.config.active ?? true
        });
      }
      setDiag(di);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
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
          data.model ? `modelo: ${data.model}` : "",
          data.statusCode !== undefined ? `HTTP ${data.statusCode}` : ""
        ].filter(Boolean);
        const msg = lines.join(" · ");
        setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", url: null, message: msg } }));
        return { id: row.id, slug: row.slug, status: "error", url: null, message: msg };
      }
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.reason === "no_provider") {
        const msg = data.message || "Configura la API de imágenes en el panel inferior antes de generar.";
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
    toast.success("Generación completa.");
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

  const runTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/admin/image-config/test", { method: "POST" });
      const data = (await r.json()) as TestResult;
      setTestResult(data);
      if (data.ok) toast.success("Conexión exitosa");
      else toast.error(data.error || "Falló la prueba");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload: Record<string, unknown> = {
        provider: configForm.provider,
        endpoint: configForm.endpoint,
        model: configForm.model,
        aspect_ratio: configForm.aspect_ratio,
        response_format: configForm.response_format,
        prompt_optimizer: configForm.prompt_optimizer,
        n: configForm.n,
        active: configForm.active
      };
      if (configForm.clear_api_key) {
        payload.clear_api_key = true;
      } else if (configForm.api_key.trim().length > 0) {
        payload.api_key = configForm.api_key.trim();
      }
      const r = await fetch("/api/admin/image-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");
      toast.success("Configuración guardada");
      setConfigForm((f) => ({ ...f, api_key: "", clear_api_key: false }));
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingConfig(false);
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
          Genera imágenes con plantilla de marca. Selecciona hasta {MAX_SELECTION} fragancias, previsualiza, y guarda las que te gusten.
        </p>
      </div>

      {diag && <DiagPanel diag={diag} testResult={testResult} />}

      <ConfigPanel
        show={showConfig}
        setShow={setShowConfig}
        form={configForm}
        setForm={setConfigForm}
        onSave={saveConfig}
        onTest={runTestConnection}
        saving={savingConfig}
        testing={testing}
        testResult={testResult}
        config={config}
      />

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
                    <span className="text-rose-300 px-3 text-center text-[11px]">{preview.message || "Error"}</span>
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

function DiagPanel({ diag, testResult }: { diag: Diag; testResult: TestResult | null }) {
  const resolved = diag.resolved;
  const hasKey = diag.has_db_config || diag.has_env_key;
  return (
    <div className="liquid-glass rounded-2xl p-3 sm:p-4 text-xs space-y-2">
      <div className="flex items-center gap-2 text-ink-mute">
        <span className={`h-2 w-2 rounded-full ${hasKey ? "bg-amber-400" : "bg-rose-400"}`} />
        <span className="font-medium">
          {hasKey
            ? `Configuración encontrada (origen: ${resolved?.source ?? "?"})`
            : "Sin configuración — completa el panel de abajo antes de generar"}
        </span>
        {testResult && (
          <span
            className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
              testResult.ok
                ? "bg-emerald-400/20 text-emerald-300"
                : "bg-rose-400/20 text-rose-300"
            }`}
          >
            {testResult.ok ? `test OK · ${testResult.image_count} img · ${testResult.elapsed_ms}ms` : "test falló"}
          </span>
        )}
      </div>
      {resolved && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-ink-mute">
          <div><span className="text-ink-mute/60">Endpoint:</span> <code className="text-ink">{resolved.endpoint}</code></div>
          <div><span className="text-ink-mute/60">Modelo:</span> <code className="text-ink">{resolved.model}</code></div>
          <div><span className="text-ink-mute/60">Origen:</span> <code className="text-ink">{resolved.source}</code></div>
        </div>
      )}
    </div>
  );
}

function ConfigPanel({
  show,
  setShow,
  form,
  setForm,
  onSave,
  onTest,
  saving,
  testing,
  testResult,
  config
}: {
  show: boolean;
  setShow: (v: boolean) => void;
  form: {
    provider: string;
    endpoint: string;
    api_key: string;
    clear_api_key: boolean;
    model: string;
    aspect_ratio: string;
    response_format: "url" | "base64";
    prompt_optimizer: boolean;
    n: number;
    active: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onTest: () => void;
  saving: boolean;
  testing: boolean;
  testResult: TestResult | null;
  config: ImageConfig | null;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-sm font-medium text-ink">⚙ Configuración del proveedor de imágenes</span>
        <span className="text-[11px] text-ink-mute">
          {config?.api_key ? `(api_key guardada · ${config.api_key})` : "(sin api_key)"}
        </span>
        <span className="ml-auto text-[10px] text-ink-mute/60">{show ? "ocultar" : "mostrar"}</span>
      </button>
      {show && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">Proveedor</span>
              <input
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">Endpoint</span>
              <input
                value={form.endpoint}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                placeholder="https://api.minimax.io/v1/image_generation"
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold font-mono"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">API Key (deja vacío para no cambiar)</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value, clear_api_key: false }))}
                  placeholder={config?.api_key ?? "sk-..."}
                  className="flex-1 bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold font-mono"
                />
                <button
                  onClick={() => setForm((f) => ({ ...f, clear_api_key: !f.clear_api_key, api_key: "" }))}
                  className={`px-3 py-2 rounded-md text-xs whitespace-nowrap ${
                    form.clear_api_key
                      ? "bg-rose-400/20 text-rose-300"
                      : "liquid-glass text-ink-mute hover:text-rose-300"
                  }`}
                >
                  {form.clear_api_key ? "Borrará al guardar" : "Borrar api_key"}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">Modelo</span>
              <input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="image-01"
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">Aspect ratio</span>
              <select
                value={form.aspect_ratio}
                onChange={(e) => setForm((f) => ({ ...f, aspect_ratio: e.target.value }))}
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">Response format</span>
              <select
                value={form.response_format}
                onChange={(e) => setForm((f) => ({ ...f, response_format: e.target.value as "url" | "base64" }))}
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              >
                <option value="url">url (expira en 24h, descarga rápido)</option>
                <option value="base64">base64 (persistente, sin descarga)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-mute">N imágenes por request</span>
              <input
                type="number"
                min={1}
                max={9}
                value={form.n}
                onChange={(e) => setForm((f) => ({ ...f, n: Math.max(1, Math.min(9, Number(e.target.value))) }))}
                className="mt-1 w-full bg-bg-elev/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="block sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.prompt_optimizer}
                onChange={(e) => setForm((f) => ({ ...f, prompt_optimizer: e.target.checked }))}
                className="h-4 w-4 accent-[color:var(--color-gold)]"
              />
              <span className="text-ink/90">Prompt optimizer (deja que la API reescriba el prompt)</span>
            </label>
            <label className="block sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 accent-[color:var(--color-gold)]"
              />
              <span className="text-ink/90">Activo (desmarca para pausar generación sin perder config)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/30">
            <button
              onClick={onSave}
              disabled={saving}
              className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
            <button
              onClick={onTest}
              disabled={testing}
              className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {testing ? "Probando…" : "Probar conexión"}
            </button>
            {testResult && (
              <span
                className={`text-[11px] px-2 py-1 rounded-full ${
                  testResult.ok
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-rose-400/20 text-rose-300"
                }`}
              >
                {testResult.ok
                  ? `OK · ${testResult.image_count ?? 0} img · ${testResult.elapsed_ms ?? 0}ms · HTTP ${testResult.status_code}`
                  : `Falló · HTTP ${testResult.status_code ?? "?"} · ${testResult.error ?? ""}`}
              </span>
            )}
          </div>

          <div className="text-[10px] text-ink-mute/80 leading-relaxed border-t border-line/30 pt-2">
            <p className="text-ink/80 font-medium">Para MiniMax (image-01):</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Endpoint fijo: <code className="text-ink">https://api.minimax.io/v1/image_generation</code></li>
              <li>Modelo: <code className="text-ink">image-01</code> (única opción)</li>
              <li>API key: obtén la tuya en <a className="text-gold hover:underline" href="https://platform.minimax.io/user-center/basic-information/interface-key" target="_blank" rel="noreferrer">platform.minimax.io</a></li>
              <li>URLs expiran en 24h (por eso descargamos a <code className="text-ink">public/fragancias/</code>)</li>
              <li>Status codes de error: 1004 (auth), 1008 (sin saldo), 1026 (prompt sensible), 2049 (key inválida)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

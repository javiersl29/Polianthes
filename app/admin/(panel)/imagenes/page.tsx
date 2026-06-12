"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Añade un query param de versión a una URL `/api/image/...` para
 * forzar al navegador a recargar la imagen (invalida cualquier cache
 * de navegador/CDN). Sin esto, después de guardar una nueva imagen
 * generada por IA, el <img> del admin seguía mostrando la versión
 * anterior porque el browser cachea por URL.
 *
 * Acepta una versión arbitraria (puede ser `image_version` del
 * backend = bytes de image_data, o un `epoch` local que bumpeamos
 * tras cada save). Cualquier cambio en el valor fuerza un nuevo fetch.
 */
function bustImageUrl(
  url: string | null | undefined,
  version: string | number | null | undefined
): string {
  if (!url) return "";
  // Solo aplicar a URLs de nuestra API interna
  if (!url.startsWith("/api/image/")) return url;
  const v = version ?? Date.now();
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${v}`;
}

/**
 * Visual del badge de género en el generador de imágenes. Permite
 * distinguir a simple vista si el perfume es para hombre, mujer o
 * unisex sin tener que abrir la ficha completa.
 */
function genderBadge(gender: "hombre" | "mujer" | "unisex" | null | undefined): {
  label: string;
  short: string;
  icon: string;
  classes: string;
} {
  switch (gender) {
    case "hombre":
      return {
        label: "Hombre",
        short: "♂",
        icon: "♂",
        classes: "bg-sky-400/15 text-sky-200 border-sky-300/30"
      };
    case "mujer":
      return {
        label: "Mujer",
        short: "♀",
        icon: "♀",
        classes: "bg-pink-400/15 text-pink-200 border-pink-300/30"
      };
    case "unisex":
      return {
        label: "Unisex",
        short: "⚥",
        icon: "⚥",
        classes: "bg-amber-400/15 text-amber-200 border-amber-300/30"
      };
    default:
      return {
        label: "Sin género",
        short: "?",
        icon: "?",
        classes: "bg-white/5 text-ink-mute border-white/10"
      };
  }
}

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
  gender?: "hombre" | "mujer" | "unisex" | null;
  image_version?: number | null;
  has_original_reference?: boolean;
  original_image_url?: string | null;
  original_image_source?: string | null;
  use_brand_bottle_override?: boolean;
};

type Preview = {
  id: number;
  slug: string;
  status: "idle" | "generating" | "ready" | "error";
  dataUrl?: string | null;
  message?: string;
  usedBrandBottle?: boolean;
  hasOriginalReference?: boolean;
};

type ImageConfig = {
  id: number;
  provider: string;
  endpoint: string;
  api_key: string | null;
  gemini_api_key: string | null;
  serpapi_api_key: string | null;
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

type BrandBottleInfo = {
  has_image: boolean;
  filename: string | null;
  size_bytes: number;
  updated_at: string | null;
};

type SerpApiTestResult = {
  ok: boolean;
  source?: string;
  db_key_length?: number;
  env_key_length?: number;
  elapsed_ms?: number;
  image_count?: number;
  first_image?: { url: string; width?: number; height?: number; source?: string } | null;
  error?: string;
  debug?: Record<string, unknown>;
};

const MAX_SELECTION = 10;
const ASPECT_RATIOS = ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"];

export default function ImagesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [refetching, setRefetching] = useState<Set<number>>(new Set());
  const [batchRefRunning, setBatchRefRunning] = useState(false);
  const [batchRefProgress, setBatchRefProgress] = useState<{ done: number; total: number } | null>(null);
  const [openModalRow, setOpenModalRow] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState<ImageConfig | null>(null);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [serpTesting, setSerpTesting] = useState(false);
  const [serpResult, setSerpResult] = useState<SerpApiTestResult | null>(null);
  const [brandBottle, setBrandBottle] = useState<BrandBottleInfo | null>(null);
  const [searchStatus, setSearchStatus] = useState<{ has_serpapi_key: boolean; has_tavily: boolean; has_serper: boolean; has_pexels: boolean } | null>(null);
  const [configForm, setConfigForm] = useState({
    provider: "minimax" as "minimax" | "gemini" | "imagen" | "openai" | "replicate",
    endpoint: "https://api.minimax.io/v1/image_generation",
    api_key: "",
    clear_api_key: false,
    gemini_api_key: "",
    clear_gemini_api_key: false,
    serpapi_api_key: "",
    clear_serpapi_api_key: false,
    model: "image-01",
    aspect_ratio: "1:1",
    response_format: "url" as "url" | "base64",
    prompt_optimizer: false,
    n: 1,
    active: true
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const brandBottleFileRef = useRef<HTMLInputElement | null>(null);
  const [refUploadTarget, setRefUploadTarget] = useState<Item | null>(null);
  const refUploadFileRef = useRef<HTMLInputElement | null>(null);
  // Contador que se incrementa en cada click de "Re-buscar" para forzar
  // variación de queries/páginas en el backend
  const [refetchCounter, setRefetchCounter] = useState(0);
  // Época que se incrementa cada vez que cambia la imagen de referencia
  // (búsqueda o upload manual). Se usa como query param en el <img> del
  // modal para forzar la recarga y evitar cache del navegador.
  const [refetchEpoch, setRefetchEpoch] = useState(0);

  // Cuando el usuario selecciona archivo en el input oculto, procesarlo
  useEffect(() => {
    if (!refUploadTarget) return;
    // Esperar al siguiente tick para asegurar que el ref esté asignado
  }, [refUploadTarget]);

  const [sources, setSources] = useState<{
    serpapi: "db" | "env" | "none";
    gen: "db" | "env" | "none";
    gemini: "db" | "env" | "none";
    minimax: "db" | "env" | "none";
    env_serpapi_length: number;
    env_gemini_length: number;
    env_minimax_length: number;
    preferred_provider: string;
  } | null>(null);

  const loadAll = async () => {
    try {
      const [fr, cfg, di, bb] = await Promise.all([
        fetch("/api/admin/fragrances").then((r) => r.json()),
        fetch("/api/admin/image-config").then((r) => r.json()),
        fetch("/api/admin/fragrances/generate-image", { method: "GET" }).then((r) => r.json()),
        fetch("/api/admin/brand-bottle").then((r) => r.json())
      ]);
      setItems(fr.items ?? []);
      setLoading(false);
      if (cfg.config) {
        setConfig(cfg.config);
        setConfigForm((prev) => ({
          ...prev,
          provider: cfg.config.provider ?? "minimax",
          endpoint: cfg.config.endpoint ?? "https://api.minimax.io/v1/image_generation",
          api_key: "",
          clear_api_key: false,
          gemini_api_key: "",
          clear_gemini_api_key: false,
          serpapi_api_key: "",
          clear_serpapi_api_key: false,
          model: cfg.config.model ?? "image-01",
          aspect_ratio: cfg.config.aspect_ratio ?? "1:1",
          response_format: cfg.config.response_format ?? "url",
          prompt_optimizer: cfg.config.prompt_optimizer ?? false,
          n: cfg.config.n ?? 1,
          active: cfg.config.active ?? true
        }));
      }
      setSources(cfg.sources ?? null);
      setDiag(di);
      setBrandBottle(di.brand_bottle ?? bb);
      setSearchStatus(di.search ?? null);
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

  const findReferenceFor = async (row: Item): Promise<boolean> => {
    setRefetching((p) => new Set(p).add(row.id));
    try {
      // Limpiar la URL anterior antes de re-buscar para evitar confusión
      // con referencias stale (especialmente si eran de sitios bloqueados)
      setItems((prev) =>
        prev.map((p) =>
          p.id === row.id
            ? {
                ...p,
                has_original_reference: false,
                original_image_url: null,
                original_image_source: null
              }
            : p
        )
      );
      const currentCount = refetchCounter;
      setRefetchCounter((c) => c + 1);
      const res = await fetch("/api/admin/fragrances/find-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: row.slug,
          persist: true,
          refetch_count: currentCount
        })
      });
      const data = await res.json();
      if (data?.ok) {
        setRefetchEpoch((e) => e + 1);
        toast.success(
          `Referencia para ${row.full_name} guardada (${data.reference?.source})`
        );
        setItems((prev) =>
          prev.map((p) =>
            p.id === row.id
              ? {
                  ...p,
                  has_original_reference: Boolean(data.persisted),
                  original_image_url: data.reference?.url ?? p.original_image_url,
                  original_image_source: data.reference?.source ?? p.original_image_source
                }
              : p
          )
        );
        return true;
      } else {
        toast.error(data?.message || data?.error || "No se encontró imagen de referencia");
        // Restaurar el estado de la card (no tiene ref)
        return false;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      return false;
    } finally {
      setRefetching((p) => {
        const n = new Set(p);
        n.delete(row.id);
        return n;
      });
    }
  };

  const batchFindReferences = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos una fragancia");
      return;
    }
    if (!searchStatus?.has_serpapi_key) {
      const proceed = window.confirm(
        "No tienes SerpAPI configurada. La búsqueda usará Tavily/Serper/Pexels como fallback (calidad inferior). ¿Continuar?"
      );
      if (!proceed) return;
    }
    setBatchRefRunning(true);
    const targets = items.filter((i) => selected.has(i.id));
    setBatchRefProgress({ done: 0, total: targets.length });
    let done = 0;
    let succeeded = 0;
    let failed = 0;
    for (const row of targets) {
      setRefetching((p) => new Set(p).add(row.id));
      try {
        const currentCount = refetchCounter;
        setRefetchCounter((c) => c + 1);
        const res = await fetch("/api/admin/fragrances/find-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: row.slug,
            persist: true,
            refetch_count: currentCount
          })
        });
        const data = await res.json();
        if (data?.ok) {
          setItems((prev) =>
            prev.map((p) =>
              p.id === row.id
                ? {
                    ...p,
                    has_original_reference: true,
                    original_image_url: data.reference?.url ?? p.original_image_url,
                    original_image_source: data.reference?.source ?? p.original_image_source
                  }
                : p
            )
          );
          succeeded += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      } finally {
        done += 1;
        setBatchRefProgress({ done, total: targets.length });
        setRefetching((p) => {
          const n = new Set(p);
          n.delete(row.id);
          return n;
        });
        // Pequeña pausa para no saturar SerpAPI
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setBatchRefRunning(false);
    setBatchRefProgress(null);
    if (succeeded > 0 && failed === 0) {
      toast.success(`Referencias guardadas (${succeeded})`);
    } else if (succeeded > 0) {
      toast.warning(`OK ${succeeded}, fallaron ${failed}`);
    } else {
      toast.error(`No se pudo guardar ninguna referencia (${failed})`);
    }
  };

  const generateOne = async (row: Item): Promise<Preview> => {
    setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "generating" } }));
    try {
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: row.slug, save: false })
      });
      const data = await res.json();
      if (data?.reason === "generation_failed" || data?.reason === "no_data") {
        const lines = [
          data.message,
          data.endpoint ? `endpoint: ${data.endpoint}` : "",
          data.model ? `modelo: ${data.model}` : "",
          data.used_brand_bottle !== undefined ? `botella de marca: ${data.used_brand_bottle ? "sí" : "no"}` : "",
          data.has_original_reference !== undefined ? `ref original: ${data.has_original_reference ? "sí" : "no"}` : ""
        ].filter(Boolean);
        const msg = lines.join(" · ");
        setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", message: msg } }));
        return { id: row.id, slug: row.slug, status: "error", message: msg };
      }
      if (!res.ok) throw new Error(data.error || "Error");
      setPreviews((p) => ({
        ...p,
        [row.id]: {
          id: row.id,
          slug: row.slug,
          status: "ready",
          dataUrl: data.data_url,
          usedBrandBottle: data.used_brand_bottle,
          hasOriginalReference: data.has_original_reference
        }
      }));
      return {
        id: row.id,
        slug: row.slug,
        status: "ready",
        dataUrl: data.data_url,
        usedBrandBottle: data.used_brand_bottle,
        hasOriginalReference: data.has_original_reference
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "error", message: msg } }));
      return { id: row.id, slug: row.slug, status: "error", message: msg };
    }
  };

  const runBatch = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos una fragancia");
      return;
    }
    if (!brandBottle?.has_image) {
      toast.error("Sube la imagen de la botella de marca antes de generar");
      return;
    }
    setBatchRunning(true);
    const targets = items.filter((i) => selected.has(i.id));
    for (const row of targets) {
      if (!row.has_original_reference && searchStatus?.has_serpapi_key) {
        await findReferenceFor(row);
      } else if (!row.has_original_reference) {
        toast.warning(`${row.full_name}: sin referencia original, se generará solo con la botella de marca`);
      }
      await generateOne(row);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBatchRunning(false);
    toast.success("Generación completa.");
  };

  const uploadOriginalFor = async (row: Item, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Máximo 10 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato: JPG, PNG o WebP");
      return;
    }
    setRefetching((p) => new Set(p).add(row.id));
    // Cerramos el modal antes de subir para que el usuario vea feedback
    setOpenModalRow(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Error leyendo archivo"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(
        `/api/admin/fragrances/original-image-upload/${row.slug}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl, source: "manual_upload" })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      // Bump refetchEpoch para forzar al <img> del modal a recargar
      // (invalida cualquier cache del navegador con un query param nuevo)
      setRefetchEpoch((e) => e + 1);
      // Actualizar la card
      setItems((prev) =>
        prev.map((p) =>
          p.id === row.id
            ? {
                ...p,
                has_original_reference: true,
                original_image_source: "manual_upload"
              }
            : p
        )
      );
      toast.success(
        `${row.full_name} → ref manual subido (${(data.size_bytes / 1024).toFixed(0)} KB), regenerando preview…`
      );
      // Regenerar preview automáticamente para que use la nueva imagen
      // (sin que el usuario tenga que hacer click en Regenerar — antes
      // la IA cacheaba la imagen anterior aunque subiéramos una nueva)
      await generateOne(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setRefetching((p) => {
        const n = new Set(p);
        n.delete(row.id);
        return n;
      });
      setRefUploadTarget(null);
    }
  };

  const acceptOne = async (row: Item) => {
    const preview = previews[row.id];
    if (!preview || preview.status !== "ready" || !preview.dataUrl) {
      toast.error("No hay preview listo para guardar");
      return;
    }
    // Marcar como "guardando" para que el botón muestre estado
    setPreviews((p) => ({ ...p, [row.id]: { ...p[row.id]!, status: "generating" } }));
    try {
      // Enviar el data_url del preview para guardar DIRECTAMENTE sin
      // re-generar (la IA no es determinista, podría sobrescribirse)
      const res = await fetch("/api/admin/fragrances/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: row.slug,
          save: true,
          data_url: preview.dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Error");
      setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, image_url: data.image_url } : p)));
      setPreviews((p) => ({ ...p, [row.id]: { ...p[row.id]!, status: "idle", dataUrl: null } }));
      // Bump refetchEpoch para forzar a TODOS los <img> que muestran
      // row.image_url a recargar (cache-bust). Sin esto, el browser
      // muestra la imagen vieja cacheada.
      setRefetchEpoch((e) => e + 1);
      toast.success(`${row.full_name} → imagen guardada (${(data.size_bytes / 1024).toFixed(0)} KB)`);
    } catch (err) {
      // Volver a "ready" para que el usuario pueda reintentar
      setPreviews((p) => ({
        ...p,
        [row.id]: { ...p[row.id]!, status: "ready" }
      }));
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  const acceptAll = async () => {
    const ready = selectedIds(items, previews);
    if (ready.length === 0) {
      toast.error("No hay previews listas para guardar");
      return;
    }
    let succeeded = 0;
    let failed = 0;
    for (const id of ready) {
      const row = items.find((i) => i.id === id);
      if (!row) continue;
      const preview = previews[id];
      if (!preview?.dataUrl) continue;
      try {
        const res = await fetch("/api/admin/fragrances/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: row.slug, save: true, data_url: preview.dataUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || "Error");
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, image_url: data.image_url } : p)));
        setPreviews((p) => ({ ...p, [id]: { ...p[id]!, status: "idle", dataUrl: null } }));
        succeeded += 1;
      } catch {
        failed += 1;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (succeeded > 0 && failed === 0) {
      toast.success(`${succeeded} imágenes guardadas`);
    } else if (succeeded > 0) {
      toast.warning(`Guardadas ${succeeded}, fallaron ${failed}`);
    } else {
      toast.error(`No se pudo guardar ninguna (${failed})`);
    }
    // Bump refetchEpoch una sola vez al final para invalidar cache de
    // todas las imágenes recién guardadas
    if (succeeded > 0) setRefetchEpoch((e) => e + 1);
  };

  const generateAndSaveAll = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos una fragancia");
      return;
    }
    if (!brandBottle?.has_image) {
      toast.error("Sube la imagen de la botella de marca antes de generar");
      return;
    }
    setBatchRunning(true);
    const targets = items.filter((i) => selected.has(i.id));
    let succeeded = 0;
    let failed = 0;
    for (const row of targets) {
      if (!row.has_original_reference && searchStatus?.has_serpapi_key) {
        await findReferenceFor(row);
      }
      // Genera
      setPreviews((p) => ({ ...p, [row.id]: { id: row.id, slug: row.slug, status: "generating" } }));
      try {
        const res = await fetch("/api/admin/fragrances/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: row.slug, save: false })
        });
        const data = await res.json();
        if (!res.ok || data?.reason === "generation_failed" || data?.reason === "no_data") {
          failed += 1;
          setPreviews((p) => ({
            ...p,
            [row.id]: { id: row.id, slug: row.slug, status: "error", message: data?.message ?? "Error" }
          }));
          continue;
        }
        // Guardar inmediatamente el preview generado
        const saveRes = await fetch("/api/admin/fragrances/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: row.slug, save: true, data_url: data.data_url })
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || saveData.message || "Error guardando");
        setItems((prev) =>
          prev.map((p) => (p.id === row.id ? { ...p, image_url: saveData.image_url } : p))
        );
        setPreviews((p) => ({
          ...p,
          [row.id]: { id: row.id, slug: row.slug, status: "idle", dataUrl: null }
        }));
        succeeded += 1;
      } catch {
        failed += 1;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setBatchRunning(false);
    if (succeeded > 0 && failed === 0) {
      toast.success(`✓ ${succeeded} imágenes generadas y guardadas`);
    } else if (succeeded > 0) {
      toast.warning(`OK ${succeeded}, fallaron ${failed}`);
    } else {
      toast.error(`No se pudo generar ninguna (${failed})`);
    }
    // Bump refetchEpoch una vez al final para invalidar cache
    if (succeeded > 0) setRefetchEpoch((e) => e + 1);
  };

  const runTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const endpoint =
      configForm.provider === "gemini"
        ? "/api/admin/image-config/test-gemini"
        : "/api/admin/image-config/test";
    const method = configForm.provider === "gemini" ? "GET" : "POST";
    try {
      const r = await fetch(endpoint, { method });
      const text = await r.text();
      let data: TestResult;
      try {
        data = JSON.parse(text) as TestResult;
      } catch {
        // Backend no devolvió JSON (error 500, 502, o HTML de mantenimiento de Railway)
        const msg = text
          ? `HTTP ${r.status}: ${text.slice(0, 200)}`
          : `HTTP ${r.status}: respuesta vacía`;
        setTestResult({
          ok: false,
          endpoint,
          model: "?",
          source: "?",
          status_code: r.status,
          error: msg
        });
        toast.error(msg);
        return;
      }
      setTestResult(data);
      if (data.ok) toast.success(`Conexión ${configForm.provider} exitosa`);
      else toast.error(data.error || "Falló la prueba");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTesting(false);
    }
  };

  const runSerpApiTest = async () => {
    setSerpTesting(true);
    setSerpResult(null);
    try {
      const r = await fetch("/api/admin/image-config/test-serpapi", { method: "GET" });
      const text = await r.text();
      let data: SerpApiTestResult;
      try {
        data = JSON.parse(text) as SerpApiTestResult;
      } catch {
        const msg = text
          ? `HTTP ${r.status}: ${text.slice(0, 200)}`
          : `HTTP ${r.status}: respuesta vacía`;
        setSerpResult({ ok: false, error: msg });
        toast.error(msg);
        return;
      }
      setSerpResult(data);
      if (data.ok) toast.success(`SerpAPI OK · ${data.image_count} imágenes`);
      else toast.error(data.error || "SerpAPI falló");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSerpTesting(false);
    }
  };

  const uploadBrandBottle = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Máximo 8 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato: JPG, PNG o WebP");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await fetch("/api/admin/brand-bottle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl, filename: file.name, mime_type: file.type })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        toast.success("Imagen de marca guardada");
        await loadAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    };
    reader.readAsDataURL(file);
  };

  const clearBrandBottle = async () => {
    try {
      const res = await fetch("/api/admin/brand-bottle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true })
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Imagen de marca eliminada");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
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
      if (configForm.clear_gemini_api_key) {
        payload.clear_gemini_api_key = true;
      } else if (configForm.gemini_api_key.trim().length > 0) {
        payload.gemini_api_key = configForm.gemini_api_key.trim();
      }
      if (configForm.clear_serpapi_api_key) {
        payload.clear_serpapi_api_key = true;
      } else if (configForm.serpapi_api_key.trim().length > 0) {
        payload.serpapi_api_key = configForm.serpapi_api_key.trim();
      }
      const r = await fetch("/api/admin/image-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");
      toast.success("Configuración guardada");
      setConfigForm((f) => ({
        ...f,
        api_key: "",
        clear_api_key: false,
        gemini_api_key: "",
        clear_gemini_api_key: false,
        serpapi_api_key: "",
        clear_serpapi_api_key: false
      }));
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
  const hasMiniMaxKey = Boolean(config?.api_key);
  const hasGeminiKey = Boolean(config?.gemini_api_key);
  const hasSerpKey = Boolean(config?.serpapi_api_key);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display italic text-2xl sm:text-3xl text-ink">Imágenes con IA</h1>
        <p className="mt-1 text-sm text-ink-mute">
          1) Sube la imagen de la botella de tu marca. 2) Busca la referencia del perfume original. 3) Genera y guarda.
        </p>
      </div>

      <BrandBottlePanel
        brandBottle={brandBottle}
        onPickFile={() => brandBottleFileRef.current?.click()}
        onClear={clearBrandBottle}
        fileInputRef={brandBottleFileRef}
        onFile={uploadBrandBottle}
        refetchEpoch={refetchEpoch}
      />

      <StatusBadges
        hasMiniMaxKey={hasMiniMaxKey || sources?.minimax !== "none"}
        hasGeminiKey={hasGeminiKey || sources?.gemini !== "none"}
        hasSerpKey={hasSerpKey || sources?.serpapi !== "none"}
        minimaxSrc={sources?.minimax ?? "none"}
        geminiSrc={sources?.gemini ?? "none"}
        serpSrc={sources?.serpapi ?? "none"}
        provider={config?.provider ?? "minimax"}
        searchStatus={searchStatus}
      />

      {diag && <DiagPanel diag={diag} testResult={testResult} serpResult={serpResult} />}

      <ConfigPanel
        show={showConfig}
        setShow={setShowConfig}
        form={configForm}
        setForm={setConfigForm}
        onSave={saveConfig}
        onTest={runTestConnection}
        onTestSerpApi={runSerpApiTest}
        saving={savingConfig}
        testing={testing}
        serpTesting={serpTesting}
        testResult={testResult}
        config={config}
        serpResult={serpResult}
        sources={sources}
      />

      <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 block">
            <span className="field-label">Buscar fragancia</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, marca, código…"
              className="field-input"
            />
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={batchFindReferences}
              disabled={batchRefRunning || selectedCount === 0}
              className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {batchRefRunning && batchRefProgress
                ? `Buscando refs ${batchRefProgress.done}/${batchRefProgress.total}…`
                : `Buscar refs (${selectedCount || 0})`}
            </button>
            <button
              onClick={runBatch}
              disabled={batchRunning || selectedCount === 0 || !brandBottle?.has_image}
              className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {batchRunning ? "Generando…" : `Generar ${selectedCount || ""} previews`}
            </button>
            <button
              onClick={generateAndSaveAll}
              disabled={batchRunning || selectedCount === 0 || !brandBottle?.has_image}
              className="liquid-glass-strong rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
              title="Genera el preview Y lo guarda inmediatamente en la DB (sin pasar por el paso manual de Guardar)"
            >
              {batchRunning ? "Generando+guardando…" : `⚡ Generar+guardar (${selectedCount || 0})`}
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
          {selectedCount}/{MAX_SELECTION} seleccionadas · {readyCount} previews listas
        </p>
        {!brandBottle?.has_image && (
          <p className="text-[11px] text-rose-300">
            Sube la imagen de la botella de marca para habilitar la generación.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-mute">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((row) => {
            const isSelected = selected.has(row.id);
            const preview = previews[row.id];
            const isFetching = refetching.has(row.id);
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-gold/80 uppercase tracking-wider truncate">{row.display_code ?? `PLT-${String(row.id).padStart(3, "0")}`}</p>
                      {(() => {
                        const g = genderBadge(row.gender);
                        return (
                          <span
                            title={`Género: ${g.label}`}
                            className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-semibold uppercase tracking-wide border ${g.classes}`}
                          >
                            <span className="text-[10px] leading-none">{g.icon}</span>
                            <span className="hidden sm:inline">{g.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="font-display italic text-sm text-ink truncate">
                      {row.artistic_name ?? row.name}
                    </p>
                    <p className="text-[10px] text-ink-mute truncate">{row.brand}</p>
                  </div>
                </label>
                <div
                  className="relative aspect-square bg-black/30 grid place-items-center text-xs text-ink-mute cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setOpenModalRow(row)}
                  title="Click para ver preview + referencia original"
                >
                  {preview?.status === "ready" && preview.dataUrl ? (
                    <>
                      <img src={preview.dataUrl} alt={`Preview IA de ${row.full_name}`} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
                        {preview.usedBrandBottle && (
                          <span className="px-1.5 py-0.5 rounded-full bg-black/70 text-[9px] text-ink uppercase tracking-wider">
                            botella marca
                          </span>
                        )}
                        {preview.hasOriginalReference && (
                          <span className="px-1.5 py-0.5 rounded-full bg-black/70 text-[9px] text-ink uppercase tracking-wider">
                            ref original
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/70 text-[9px] text-gold uppercase tracking-wider">
                        ⤢ ver
                      </div>
                    </>
                  ) : preview?.status === "generating" ? (
                    <div className="flex flex-col items-center gap-1 text-gold">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="text-[10px] uppercase tracking-wider">Generando…</span>
                    </div>
                  ) : preview?.status === "error" ? (
                    <span className="text-rose-300 px-3 text-center text-[11px]">{preview.message || "Error"}</span>
                  ) : row.image_url ? (
                    <img src={bustImageUrl(row.image_url, row.image_version ?? refetchEpoch)} alt={row.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span>Sin imagen</span>
                  )}
                </div>
                <div className="p-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] text-ink-mute px-1">
                    <span>
                      {row.has_original_reference
                        ? `Ref: ${row.original_image_source ?? "OK"}`
                        : "Sin ref original"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRefUploadTarget(row);
                          refUploadFileRef.current?.click();
                        }}
                        disabled={isFetching}
                        title="Subir tu propia imagen de referencia"
                        className="text-ink-mute hover:text-gold disabled:opacity-50"
                      >
                        ⬆ Subir
                      </button>
                      <button
                        onClick={() => findReferenceFor(row)}
                        disabled={isFetching}
                        className="text-gold hover:text-gold/80 disabled:opacity-50"
                      >
                        {isFetching ? "Buscando…" : row.has_original_reference ? "Re-buscar" : "Buscar"}
                      </button>
                    </div>
                  </div>
                  {preview?.status === "ready" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptOne(row)}
                        className="flex-1 liquid-glass-strong rounded-full px-3 py-1.5 text-xs hover:text-gold"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => generateOne(row)}
                        disabled={batchRunning}
                        className="flex-1 liquid-glass rounded-full px-3 py-1.5 text-xs hover:text-gold disabled:opacity-50"
                      >
                        Regenerar
                      </button>
                    </div>
                  )}
                  {preview?.status === "idle" && row.image_url && row.image_url.startsWith("/api/image/") && (
                    <div className="px-2 py-1 rounded-md bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-[10px] flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Guardada en DB
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openModalRow && (
        <PreviewModal
          key={`modal-${openModalRow.id}-${refetchEpoch}`}
          row={openModalRow}
          preview={previews[openModalRow.id]}
          onClose={() => setOpenModalRow(null)}
          refetchEpoch={refetchEpoch}
          onUploadClick={() => {
            setRefUploadTarget(openModalRow);
            setOpenModalRow(null);
            setTimeout(() => refUploadFileRef.current?.click(), 100);
          }}
          onRefetchClick={() => {
            const r = openModalRow;
            setOpenModalRow(null);
            setTimeout(() => findReferenceFor(r), 100);
          }}
        />
      )}
      <input
        ref={refUploadFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && refUploadTarget) uploadOriginalFor(refUploadTarget, f);
          e.target.value = "";
          setRefUploadTarget(null);
        }}
      />
    </div>
  );
}

function PreviewModal({
  row,
  preview,
  onClose,
  onUploadClick,
  onRefetchClick,
  refetchEpoch
}: {
  row: Item;
  preview: Preview | undefined;
  onClose: () => void;
  onUploadClick: () => void;
  onRefetchClick: () => void;
  refetchEpoch: number;
}) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);
  // Cada vez que cambia refetchEpoch, la URL cambia (query param único)
  // y fuerza al <img> a recargar desde el servidor (sin cache).
  const originalImgUrl = `/api/admin/fragrances/original-image/${row.slug}?v=${refetchEpoch}`;

  // Si el preview no está listo, igualmente abrimos el modal para mostrar la
  // referencia original si existe.
  useEffect(() => {
    if (!row.has_original_reference) return;
    setOriginalLoading(true);
    setOriginalError(null);
    fetch(originalImgUrl, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          setOriginalError(`HTTP ${r.status}`);
          return;
        }
        const ct = r.headers.get("content-type") ?? "image/jpeg";
        const blob = await r.blob();
        const reader = new FileReader();
        reader.onload = () => {
          setOriginalUrl(reader.result as string);
          setOriginalLoading(false);
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        setOriginalError(err instanceof Error ? err.message : "Error");
        setOriginalLoading(false);
      });
  }, [row.id, row.has_original_reference, originalImgUrl]);

  const downloadOriginal = () => {
    if (!originalUrl) return;
    const a = document.createElement("a");
    a.href = originalUrl;
    a.download = `ref-${row.slug}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPreview = () => {
    if (!preview?.dataUrl) return;
    const a = document.createElement("a");
    a.href = preview.dataUrl;
    a.download = `preview-${row.slug}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="liquid-glass-strong rounded-2xl p-4 sm:p-5 max-w-5xl w-full max-h-[92vh] overflow-auto space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gold uppercase tracking-wider">
                {row.display_code ?? `PLT-${String(row.id).padStart(3, "0")}`}
              </p>
              {(() => {
                const g = genderBadge(row.gender);
                return (
                  <span
                    title={`Género: ${g.label}`}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${g.classes}`}
                  >
                    <span className="text-[11px] leading-none">{g.icon}</span>
                    <span>{g.label}</span>
                  </span>
                );
              })()}
            </div>
            <p className="font-display italic text-lg sm:text-xl text-ink truncate">
              {row.artistic_name ?? row.name}
            </p>
            <p className="text-xs text-ink-mute truncate">
              {row.full_name}
              {row.original_image_source
                ? ` · ref: ${row.original_image_source}`
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="liquid-glass rounded-full px-3 py-1.5 text-xs hover:text-gold shrink-0"
            aria-label="Cerrar modal"
          >
            ✕ Cerrar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* === IZQUIERDA: Referencia original === */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span className="text-gold/80 font-semibold">Referencia original</span>
              {originalUrl && (
                <button
                  onClick={downloadOriginal}
                  className="text-gold hover:text-gold/80 normal-case tracking-normal"
                >
                  ⬇ Descargar
                </button>
              )}
            </div>
            <div className="aspect-square bg-black/30 rounded-xl overflow-hidden grid place-items-center text-xs text-ink-mute">
              {row.has_original_reference ? (
                originalLoading ? (
                  <span className="text-gold">Cargando…</span>
                ) : originalError ? (
                  <span className="text-rose-300 px-3 text-center text-[11px]">
                    Error: {originalError}
                  </span>
                ) : originalUrl ? (
                  <img
                    src={originalUrl}
                    alt={`Referencia original de ${row.full_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Sin imagen</span>
                )
              ) : (
                <span className="px-3 text-center text-[11px]">
                  Sin ref. Click &quot;Buscar ref&quot; en la card para encontrar una.
                </span>
              )}
            </div>
            {row.original_image_url && !row.has_original_reference && (
              <div className="px-2 py-1 rounded-md bg-rose-400/15 border border-rose-400/30 text-rose-300 text-[10px] flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Link guardado pero no se pudo descargar (sitio bloquea hotlinking)
                <a
                  href={row.original_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto underline hover:text-rose-200 truncate max-w-[140px]"
                  title={row.original_image_url}
                >
                  abrir
                </a>
              </div>
            )}
            {!row.has_original_reference && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onClose()}
                  className="liquid-glass rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider hover:text-gold"
                >
                  Cerrar
                </button>
                <button
                  onClick={onUploadClick}
                  className="flex-1 liquid-glass-strong rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider hover:text-gold"
                >
                  ⬆ Subir mi imagen
                </button>
              </div>
            )}
            {row.has_original_reference && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onUploadClick}
                  className="liquid-glass rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider hover:text-gold"
                  title="Reemplazar la referencia actual con una imagen de tu computadora"
                >
                  Reemplazar
                </button>
                <button
                  onClick={onRefetchClick}
                  className="flex-1 liquid-glass rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider hover:text-gold"
                >
                  Re-buscar online
                </button>
              </div>
            )}
            {row.original_image_url && row.has_original_reference && (
              <a
                href={row.original_image_url}
                target="_blank"
                rel="noreferrer"
                className="block text-[10px] text-ink-mute hover:text-gold truncate"
                title={row.original_image_url}
              >
                🔗 {row.original_image_url}
              </a>
            )}
          </div>

          {/* === DERECHA: Preview IA actual === */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span className="text-gold/80 font-semibold">Preview IA (último)</span>
              {preview?.dataUrl && (
                <button
                  onClick={downloadPreview}
                  className="text-gold hover:text-gold/80 normal-case tracking-normal"
                >
                  ⬇ Descargar
                </button>
              )}
            </div>
            <div className="aspect-square bg-black/30 rounded-xl overflow-hidden grid place-items-center text-xs text-ink-mute">
              {preview?.status === "ready" && preview.dataUrl ? (
                <img
                  src={preview.dataUrl}
                  alt={`Preview IA de ${row.full_name}`}
                  className="w-full h-full object-cover"
                />
              ) : preview?.status === "generating" ? (
                <span className="text-gold">Generando…</span>
              ) : preview?.status === "error" ? (
                <span className="text-rose-300 px-3 text-center text-[11px]">
                  {preview.message || "Error"}
                </span>
              ) : row.image_url ? (
                <img
                  src={bustImageUrl(row.image_url, row.image_version ?? refetchEpoch)}
                  alt={row.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>Sin preview. Click &quot;Generar preview&quot;.</span>
              )}
            </div>
            {preview?.usedBrandBottle && (
              <p className="text-[10px] text-ink-mute">✓ Usa botella de marca</p>
            )}
            {preview?.hasOriginalReference && (
              <p className="text-[10px] text-ink-mute">✓ Usa ref original</p>
            )}
          </div>
        </div>

        <div className="text-[10px] text-ink-mute/80 border-t border-line/30 pt-2">
          La imagen final guardada se sirve desde <code>/api/image/&lt;slug&gt;</code> y la ref desde
          <code> /api/admin/fragrances/original-image/&lt;slug&gt;</code>.
        </div>
      </div>
    </div>
  );
}

function selectedIds(items: Item[], previews: Record<number, Preview>): number[] {
  return items.filter((i) => previews[i.id]?.status === "ready").map((i) => i.id);
}

function StatusBadges({
  hasMiniMaxKey,
  hasGeminiKey,
  hasSerpKey,
  minimaxSrc,
  geminiSrc,
  serpSrc,
  provider,
  searchStatus
}: {
  hasMiniMaxKey: boolean;
  hasGeminiKey: boolean;
  hasSerpKey: boolean;
  minimaxSrc: "db" | "env" | "none";
  geminiSrc: "db" | "env" | "none";
  serpSrc: "db" | "env" | "none";
  provider: string;
  searchStatus: { has_serpapi_key: boolean; has_tavily: boolean; has_serper: boolean; has_pexels: boolean } | null;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-3 sm:p-4">
      <p className="field-label mb-2">Estado de configuración</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={`px-2 py-1 rounded-full ${
            provider === "gemini"
              ? hasGeminiKey
                ? "badge-ok"
                : "badge-err"
              : provider === "minimax"
              ? hasMiniMaxKey
                ? "badge-ok"
                : "badge-err"
              : "badge-off"
          }`}
        >
          {provider === "gemini" ? "🤖 Gemini" : "🔷 MiniMax"}:{" "}
          {provider === "gemini"
            ? hasGeminiKey
              ? `activa${geminiSrc === "db" ? " (db)" : geminiSrc === "env" ? " (env)" : ""}`
              : "falta"
            : provider === "minimax"
            ? hasMiniMaxKey
              ? `activa${minimaxSrc === "db" ? " (db)" : minimaxSrc === "env" ? " (env)" : ""}`
              : "falta"
            : "—"}
        </span>
        <span className={`px-2 py-1 rounded-full ${hasSerpKey ? "badge-ok" : "badge-warn"}`}>
          {hasSerpKey ? "✓ SerpAPI" : "⚠ Sin SerpAPI"}
          {serpSrc === "db" ? " (db)" : serpSrc === "env" ? " (env)" : ""}
          {!hasSerpKey && " — cae a Tavily/Serper/Pexels"}
        </span>
        {searchStatus?.has_tavily && (
          <span className="px-2 py-1 rounded-full badge-info">Tavily</span>
        )}
        {searchStatus?.has_serper && (
          <span className="px-2 py-1 rounded-full badge-info">Serper</span>
        )}
        {searchStatus?.has_pexels && (
          <span className="px-2 py-1 rounded-full badge-info">Pexels</span>
        )}
      </div>
    </div>
  );
}

function BrandBottlePanel({
  brandBottle,
  onPickFile,
  onClear,
  fileInputRef,
  onFile,
  refetchEpoch
}: {
  brandBottle: BrandBottleInfo | null;
  onPickFile: () => void;
  onClear: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (file: File) => void;
  refetchEpoch: number;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/30 grid place-items-center text-ink-mute text-xs shrink-0">
          {brandBottle?.has_image ? (
            <img src={bustImageUrl("/api/image/brand-bottle", refetchEpoch)} alt="Botella de la marca" className="w-full h-full object-cover" />
          ) : (
            <span>Sin imagen</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-ink">Botella de la marca</p>
          <p className="text-[11px] text-ink-mute">
            Sube una foto de la botella con la etiqueta de tu marca. Se usará como sujeto principal en cada generación.
            {brandBottle?.has_image && brandBottle.size_bytes > 0 && (
              <> · Tamaño: {(brandBottle.size_bytes / 1024).toFixed(0)} KB{brandBottle.filename ? ` · ${brandBottle.filename}` : ""}</>
            )}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onPickFile}
              className="liquid-glass-strong rounded-full px-3 py-1.5 text-xs hover:text-gold"
            >
              {brandBottle?.has_image ? "Reemplazar" : "Subir imagen"}
            </button>
            {brandBottle?.has_image && (
              <button
                onClick={onClear}
                className="liquid-glass rounded-full px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DiagPanel({
  diag,
  testResult,
  serpResult
}: {
  diag: Diag;
  testResult: TestResult | null;
  serpResult: SerpApiTestResult | null;
}) {
  const resolved = diag.resolved;
  const hasKey = diag.has_db_config || diag.has_env_key;
  return (
    <div className="liquid-glass rounded-2xl p-3 sm:p-4 space-y-2">
      <p className="field-label">Diagnóstico</p>
      {resolved && (
        <div className="space-y-1">
          <div className="kv-row">
            <span className="kv-key">Endpoint generación:</span>
            <span className="kv-value">{resolved.endpoint}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Modelo:</span>
            <span className="kv-value">{resolved.model}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Origen config:</span>
            <span className="kv-value">{resolved.source}</span>
          </div>
        </div>
      )}
      {testResult && (
        <div className="kv-row">
          <span className="kv-key">Último test gen:</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              testResult.ok ? "badge-ok" : "badge-err"
            }`}
          >
            {testResult.ok
              ? `OK · ${testResult.image_count} img · ${testResult.elapsed_ms}ms`
              : `falló · ${testResult.error ?? ""}`}
          </span>
        </div>
      )}
      {serpResult && (
        <div className="kv-row">
          <span className="kv-key">Último test SerpAPI:</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              serpResult.ok ? "badge-ok" : "badge-err"
            }`}
          >
            {serpResult.ok
              ? `OK · ${serpResult.image_count} img · ${serpResult.elapsed_ms}ms${
                  serpResult.source ? ` · fuente: ${serpResult.source}` : ""
                }`
              : `falló · ${serpResult.error ?? ""}${
                  serpResult.db_key_length !== undefined
                    ? ` · DB key len: ${serpResult.db_key_length}, ENV key len: ${serpResult.env_key_length}`
                    : ""
                }`}
          </span>
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
  onTestSerpApi,
  saving,
  testing,
  serpTesting,
  testResult,
  config,
  serpResult,
  sources
}: {
  show: boolean;
  setShow: (v: boolean) => void;
  form: {
    provider: "minimax" | "gemini" | "imagen" | "openai" | "replicate";
    endpoint: string;
    api_key: string;
    clear_api_key: boolean;
    gemini_api_key: string;
    clear_gemini_api_key: boolean;
    serpapi_api_key: string;
    clear_serpapi_api_key: boolean;
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
  onTestSerpApi: () => void;
  saving: boolean;
  testing: boolean;
  serpTesting: boolean;
  testResult: TestResult | null;
  config: ImageConfig | null;
  serpResult: SerpApiTestResult | null;
  sources: {
    serpapi: "db" | "env" | "none";
    gen: "db" | "env" | "none";
    gemini: "db" | "env" | "none";
    minimax: "db" | "env" | "none";
  } | null;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-sm font-medium text-ink">⚙ Configuración del proveedor de imágenes y búsqueda</span>
        <span className="ml-auto text-[10px] text-ink-mute/80">{show ? "ocultar" : "mostrar"}</span>
      </button>
      {show && (
        <div className="space-y-3 pt-2">
          {/* === Estado actual de las keys === */}
          <div className="space-y-1 border border-line/30 rounded-lg p-3 bg-black/40">
            <p className="field-label">Keys activas</p>
            <div className="kv-row">
              <span className="kv-key">🔷 MiniMax (gen):</span>
              <span className="kv-value">
                {config?.api_key ?? (sources?.minimax === "env" ? "(env:MINIMAX_API_KEY)" : "(no guardada)")}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  sources?.minimax !== "none" ? "badge-ok" : "badge-err"
                }`}
              >
                {sources?.minimax === "db" ? "DB ✓" : sources?.minimax === "env" ? "ENV ✓" : "falta"}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">🤖 Gemini (gen):</span>
              <span className="kv-value">
                {config?.gemini_api_key ?? (sources?.gemini === "env" ? "(env:GEMINI_API_KEY)" : "(no guardada)")}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  sources?.gemini !== "none" ? "badge-ok" : "badge-err"
                }`}
              >
                {sources?.gemini === "db" ? "DB ✓" : sources?.gemini === "env" ? "ENV ✓" : "falta"}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">🔍 SerpAPI (búsqueda):</span>
              <span className="kv-value">
                {config?.serpapi_api_key ?? (sources?.serpapi === "env" ? "(env:SERPAPI_API_KEY)" : "(no guardada)")}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  sources?.serpapi !== "none" ? "badge-ok" : "badge-warn"
                }`}
              >
                {sources?.serpapi === "db" ? "DB ✓" : sources?.serpapi === "env" ? "ENV ✓" : "falta"}
              </span>
            </div>
            <p className="text-[10px] text-ink-mute/80 pt-1">
              Cada key es independiente. DB toma precedencia si está guardada. ENV se usa como fallback.
              Configura el provider arriba para usar Gemini o MiniMax.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Proveedor de generación</span>
              <select
                value={form.provider}
                onChange={(e) => {
                  const p = e.target.value as "minimax" | "gemini" | "imagen" | "openai" | "replicate";
                  setForm((f) => {
                    if (p === "gemini") {
                      return {
                        ...f,
                        provider: p,
                        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
                        model: "gemini-3.1-flash-image",
                        response_format: "base64",
                        n: 1,
                        prompt_optimizer: false
                      };
                    }
                    if (p === "minimax") {
                      return {
                        ...f,
                        provider: p,
                        endpoint: "https://api.minimax.io/v1/image_generation",
                        model: "image-01",
                        response_format: "url",
                        n: 1
                      };
                    }
                    return { ...f, provider: p };
                  });
                }}
                className="field-select"
              >
                <option value="gemini">Google Gemini (Nano Banana 2) — multi-ref ✓</option>
                <option value="minimax">MiniMax (image-01) — 1 ref</option>
                <option value="openai">OpenAI (próximamente)</option>
                <option value="replicate">Replicate (próximamente)</option>
              </select>
              <p className="text-[10px] text-ink-mute/80 pt-1">
                {form.provider === "gemini"
                  ? "Gemini acepta hasta 14 imágenes de referencia. La botella de tu marca y el perfume original se usan ambos."
                  : form.provider === "minimax"
                  ? "MiniMax image-01 acepta solo 1 imagen de referencia. Se usa solo la botella de marca."
                  : "Próximamente"}
              </p>
            </label>
            <label className="block">
              <span className="field-label">Endpoint</span>
              <input
                value={form.endpoint}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                placeholder={form.provider === "gemini" ? "https://generativelanguage.googleapis.com/..." : "https://api.minimax.io/v1/image_generation"}
                className="field-input font-mono"
                style={{ fontSize: 12 }}
              />
            </label>

            {/* === MiniMax key (solo si provider = minimax) === */}
            {form.provider === "minimax" && (
              <div className="sm:col-span-2 space-y-1">
                <span className="field-label">🔷 API Key de MiniMax (generación)</span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value, clear_api_key: false }))}
                    placeholder={config?.api_key ?? "sk-..."}
                    className="field-input font-mono"
                    style={{ fontSize: 12 }}
                  />
                  <button
                    onClick={() => setForm((f) => ({ ...f, clear_api_key: !f.clear_api_key, api_key: "" }))}
                    className={`px-3 py-2 rounded-md text-xs whitespace-nowrap ${
                      form.clear_api_key
                        ? "badge-err"
                        : "liquid-glass text-ink-mute hover:text-rose-300"
                    }`}
                  >
                    {form.clear_api_key ? "Borrará al guardar" : "Borrar"}
                  </button>
                </div>
                <p className="text-[10px] text-ink-mute/80">
                  Si la dejas vacía, se usa <code>MINIMAX_API_KEY</code> de Railway.
                </p>
              </div>
            )}

            {/* === Gemini key (solo si provider = gemini) === */}
            {form.provider === "gemini" && (
              <div className="sm:col-span-2 space-y-1">
                <span className="field-label">🤖 API Key de Google Gemini (Google AI Studio)</span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={form.gemini_api_key}
                    onChange={(e) => setForm((f) => ({ ...f, gemini_api_key: e.target.value, clear_gemini_api_key: false }))}
                    placeholder={config?.gemini_api_key ?? "AIza..."}
                    className="field-input font-mono"
                    style={{ fontSize: 12 }}
                  />
                  <button
                    onClick={() => setForm((f) => ({ ...f, clear_gemini_api_key: !f.clear_gemini_api_key, gemini_api_key: "" }))}
                    className={`px-3 py-2 rounded-md text-xs whitespace-nowrap ${
                      form.clear_gemini_api_key
                        ? "badge-err"
                        : "liquid-glass text-ink-mute hover:text-rose-300"
                    }`}
                  >
                    {form.clear_gemini_api_key ? "Borrará al guardar" : "Borrar"}
                  </button>
                </div>
                <p className="text-[10px] text-ink-mute/80">
                  Distinta de SerpAPI. Obtén la tuya en{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold hover:underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                  . Si la dejas vacía, se usa <code>GEMINI_API_KEY</code> de Railway.
                </p>
              </div>
            )}

            {/* === SerpAPI key === */}
            <div className="sm:col-span-2 space-y-1">
              <span className="field-label">
                API Key de SerpAPI (Google Images) — opcional pero recomendado
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={form.serpapi_api_key}
                  onChange={(e) => setForm((f) => ({ ...f, serpapi_api_key: e.target.value, clear_serpapi_api_key: false }))}
                  placeholder={config?.serpapi_api_key ?? "serpapi key…"}
                  className="field-input font-mono"
                  style={{ fontSize: 12 }}
                />
                <button
                  onClick={() => setForm((f) => ({ ...f, clear_serpapi_api_key: !f.clear_serpapi_api_key, serpapi_api_key: "" }))}
                  className={`px-3 py-2 rounded-md text-xs whitespace-nowrap ${
                    form.clear_serpapi_api_key
                      ? "badge-err"
                      : "liquid-glass text-ink-mute hover:text-rose-300"
                  }`}
                >
                  {form.clear_serpapi_api_key ? "Borrará al guardar" : "Borrar"}
                </button>
              </div>
              <a
                href="https://serpapi.com/manage-api-key"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-gold hover:underline mt-1 inline-block"
              >
                Obtener api_key en serpapi.com →
              </a>
            </div>

            <label className="block">
              <span className="field-label">Modelo</span>
              <input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="image-01"
                className="field-input font-mono"
                style={{ fontSize: 12 }}
              />
            </label>
            <label className="block">
              <span className="field-label">Aspect ratio</span>
              <select
                value={form.aspect_ratio}
                onChange={(e) => setForm((f) => ({ ...f, aspect_ratio: e.target.value }))}
                className="field-select"
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Response format</span>
              <select
                value={form.response_format}
                onChange={(e) => setForm((f) => ({ ...f, response_format: e.target.value as "url" | "base64" }))}
                className="field-select"
              >
                <option value="url">url (recomendado — se descarga y guarda)</option>
                <option value="base64">base64 (sin descarga, más persistente)</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">N imágenes por request</span>
              <input
                type="number"
                min={1}
                max={9}
                value={form.n}
                onChange={(e) => setForm((f) => ({ ...f, n: Math.max(1, Math.min(9, Number(e.target.value))) }))}
                className="field-input"
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
              {testing
                ? "Probando…"
                : form.provider === "gemini"
                ? "Probar Gemini"
                : form.provider === "minimax"
                ? "Probar MiniMax"
                : "Probar generación"}
            </button>
            <button
              onClick={onTestSerpApi}
              disabled={serpTesting}
              className="liquid-glass rounded-full px-4 py-2 text-sm hover:text-gold disabled:opacity-50"
            >
              {serpTesting ? "Probando…" : "Probar SerpAPI"}
            </button>
            {testResult && (
              <span
                className={`text-[11px] px-2 py-1 rounded-full ${
                  testResult.ok ? "badge-ok" : "badge-err"
                }`}
              >
                {testResult.ok
                  ? `gen OK · ${testResult.image_count ?? 0} img · ${testResult.elapsed_ms ?? 0}ms`
                  : `gen falló · ${testResult.error ?? ""}`}
              </span>
            )}
            {serpResult && (
              <span
                className={`text-[11px] px-2 py-1 rounded-full ${
                  serpResult.ok ? "badge-ok" : "badge-err"
                }`}
              >
                {serpResult.ok
                  ? `serp OK · ${serpResult.image_count ?? 0} img · ${serpResult.elapsed_ms ?? 0}ms${
                      serpResult.source ? ` · ${serpResult.source}` : ""
                    }`
                  : `serp falló · ${serpResult.error ?? ""}${
                      serpResult.db_key_length !== undefined
                        ? ` · DB:${serpResult.db_key_length}c ENV:${serpResult.env_key_length}c`
                        : ""
                    }`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

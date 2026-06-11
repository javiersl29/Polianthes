import { query } from "./db";
import { getAiConfig } from "./ai-config";

export type ImageGenerationInput = {
  fragranceName: string;
  brand: string;
  family: string | null;
  mood: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  promptOverride?: string;
};

export type ImageGenerationResult = {
  ok: boolean;
  url?: string;
  b64?: string;
  revisedPrompt?: string;
  model: string;
  endpoint?: string;
  provider: "minimax" | "mock";
  error?: string;
  debug?: Record<string, unknown>;
};

const FAMILY_MOOD_HINTS: Record<string, string> = {
  Floral: "rose petals, jasmine, soft powdery",
  Oriental: "amber, vanilla, warm spices",
  Amaderado: "sandalwood, cedar, oud, smoke",
  Chipre: "moss, patchouli, bergamot",
  Cítrico: "lemon, bergamot, fresh citrus zest",
  Gourmand: "vanilla, caramel, coffee, sweet pastry"
};

const MOOD_HINTS: Record<string, string> = {
  Misterio: "deep shadow, mysterious",
  Romántico: "soft pink light, romantic, dreamy",
  Energía: "bright vibrant glow, dynamic",
  Frescura: "cool blue tone, fresh, airy",
  Sofisticado: "muted elegance, refined",
  Nostálgico: "warm sepia, vintage, nostalgic"
};

export function buildImagePrompt(input: ImageGenerationInput): string {
  if (input.promptOverride && input.promptOverride.trim().length > 0) {
    return input.promptOverride.trim();
  }
  const familyHint = input.family ? FAMILY_MOOD_HINTS[input.family] ?? input.family.toLowerCase() : "";
  const moodHint = input.mood ? MOOD_HINTS[input.mood] ?? input.mood.toLowerCase() : "";
  const allNotes = [...(input.topNotes ?? []), ...(input.heartNotes ?? []), ...(input.baseNotes ?? [])]
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  return [
    "Editorial luxury perfume photography.",
    "A generic faceted glass perfume bottle silhouette in the foreground, center frame, three-quarter angle, eye level, no labels, no logos, no text, no brand markings, no recognizable branded product.",
    "Behind the bottle, an out-of-focus blurred ghost image of the original perfume referenced (heavily defocused, soft bokeh, low contrast) — recognizable only as a soft colorful glow shape, never sharp or identifiable.",
    "Background: deep charcoal black (#0c0c0c) with a single soft golden volumetric light from the upper left (#d4af6a, warm, low intensity).",
    "Cinematic 85mm lens, f/2.8, photorealistic, soft bokeh, slight grain.",
    familyHint ? `Mood of the fragrance: ${familyHint}.` : "",
    moodHint ? `Atmosphere: ${moodHint}.` : "",
    allNotes ? `Scent cues: ${allNotes}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export type ResolvedImageConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  source: "env" | "db_ai_config";
};

export async function resolveImageConfig(): Promise<ResolvedImageConfig | null> {
  // 1) Variables de entorno explícitas (tienen prioridad)
  const envKey = process.env.MINIMAX_IMAGE_API_KEY;
  const envEndpoint = process.env.MINIMAX_IMAGE_ENDPOINT;
  const envModel = process.env.MINIMAX_IMAGE_MODEL;
  if (envKey && envEndpoint) {
    return {
      endpoint: envEndpoint,
      apiKey: envKey,
      model: envModel || "minimax-image-01",
      source: "env"
    };
  }

  // 2) Fallback: usar api_key de ai_config + endpoint construido
  const cfg = await getAiConfig();
  if (!cfg.api_key) return null;
  const base = (cfg.base_url ?? "https://api.minimax.io/v1").replace(/\/+$/, "");
  return {
    endpoint: `${base}/image_generation`,
    apiKey: cfg.api_key,
    model: envModel || "minimax-image-01",
    source: "db_ai_config"
  };
}

export async function generateImage(
  input: ImageGenerationInput
): Promise<ImageGenerationResult> {
  const cfg = await resolveImageConfig();
  if (!cfg) {
    return {
      ok: false,
      provider: "mock",
      model: "none",
      error: "No hay configuración de imagen. Define MINIMAX_IMAGE_API_KEY + MINIMAX_IMAGE_ENDPOINT en Railway, o configura la api_key en /admin/ai.",
      debug: { hint: "Falta API key de imagen en env y en ai_config" }
    };
  }

  const prompt = buildImagePrompt(input);
  const body: Record<string, unknown> = {
    model: cfg.model,
    prompt,
    n: 1,
    size: "1024x1024"
  };

  let response: Response;
  try {
    response = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: `No se pudo conectar: ${err instanceof Error ? err.message : "Error de red"}`,
      debug: { body, config_source: cfg.source }
    };
  }

  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: `HTTP ${response.status}: ${text.slice(0, 500)}`,
      debug: { body, config_source: cfg.source, response_excerpt: text.slice(0, 500) }
    };
  }

  let data: {
    data?: Array<{ url?: string; b64_json?: string; image_base64?: string; revised_prompt?: string }>;
    model?: string;
    image_url?: string;
    images?: string[];
  };
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: "Respuesta no es JSON válido",
      debug: { response_excerpt: text.slice(0, 500) }
    };
  }

  // Distintas formas de respuesta según el proveedor
  const url =
    data.data?.[0]?.url ??
    data.image_url ??
    data.images?.[0];
  const b64 = data.data?.[0]?.b64_json ?? data.data?.[0]?.image_base64;

  if (!url && !b64) {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: "La API no devolvió imagen (ni url ni b64)",
      debug: { response: data }
    };
  }

  return {
    ok: true,
    url,
    b64,
    revisedPrompt: data.data?.[0]?.revised_prompt,
    model: data.model ?? cfg.model,
    endpoint: cfg.endpoint,
    provider: "minimax"
  };
}

export type DbImageConfig = {
  has_ai_config: boolean;
  ai_base_url: string | null;
  env_endpoint: string | null;
  env_model: string | null;
  has_env_key: boolean;
  resolved: ResolvedImageConfig | null;
};

/**
 * Endpoint de diagnóstico: devuelve qué configuración está viendo el servidor.
 * Útil para debuggear "qué endpoint/modelo está usando realmente".
 */
export async function getImageConfigDiagnostics(): Promise<DbImageConfig> {
  const envKey = process.env.MINIMAX_IMAGE_API_KEY;
  const envEndpoint = process.env.MINIMAX_IMAGE_ENDPOINT;
  const envModel = process.env.MINIMAX_IMAGE_MODEL;
  const cfg = await getAiConfig();
  const resolved = await resolveImageConfig();
  return {
    has_ai_config: Boolean(cfg.api_key),
    ai_base_url: cfg.base_url,
    env_endpoint: envEndpoint ?? null,
    env_model: envModel ?? null,
    has_env_key: Boolean(envKey),
    resolved
  };
}

/**
 * Ping contra el endpoint de imágenes sin gastar créditos. Útil para verificar config.
 */
export async function pingImageEndpoint(): Promise<{
  ok: boolean;
  endpoint: string;
  model: string;
  status?: number;
  error?: string;
}> {
  const cfg = await resolveImageConfig();
  if (!cfg) {
    return { ok: false, endpoint: "(no config)", model: "?", error: "Sin configuración" };
  }
  // Ping de bajo costo: usamos una llamada de chat al endpoint, o un GET si existe
  // La estrategia más segura: mandar una generación con prompt vacío y un timeout corto,
  // y devolver el status code (no 404 = endpoint existe).
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({ model: cfg.model, prompt: "ping", n: 1, size: "256x256" }),
      signal: AbortSignal.timeout(8000)
    });
    return {
      ok: res.status !== 404,
      endpoint: cfg.endpoint,
      model: cfg.model,
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      endpoint: cfg.endpoint,
      model: cfg.model,
      error: err instanceof Error ? err.message : "Error"
    };
  }
}

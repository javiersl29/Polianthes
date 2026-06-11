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
  errorCode?: number;
  statusCode?: number;
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

export type ImageApiConfig = {
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

export async function getImageApiConfig(): Promise<ImageApiConfig | null> {
  const r = await query<ImageApiConfig>(
    `SELECT id, provider, endpoint, api_key, model, aspect_ratio, response_format,
            prompt_optimizer, n, active, updated_at
     FROM image_api_config WHERE id = 1`
  );
  return r.rows[0] ?? null;
}

export type ResolvedImageConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  aspectRatio: string;
  responseFormat: "url" | "base64";
  n: number;
  promptOptimizer: boolean;
  source: "db" | "env" | "fallback";
};

const DEFAULT_ENDPOINT = "https://api.minimax.io/v1/image_generation";
const DEFAULT_MODEL = "image-01";

export async function resolveImageConfig(): Promise<ResolvedImageConfig | null> {
  // 1) DB image_api_config (preferido)
  const dbCfg = await getImageApiConfig();
  const envKey = process.env.MINIMAX_API_KEY;
  const envEndpoint = process.env.MINIMAX_IMAGE_ENDPOINT;
  const envModel = process.env.MINIMAX_IMAGE_MODEL;

  if (dbCfg && dbCfg.active && dbCfg.api_key) {
    return {
      endpoint: dbCfg.endpoint,
      apiKey: dbCfg.api_key,
      model: dbCfg.model,
      aspectRatio: dbCfg.aspect_ratio,
      responseFormat: dbCfg.response_format,
      n: dbCfg.n,
      promptOptimizer: dbCfg.prompt_optimizer,
      source: "db"
    };
  }
  // 2) Variables de entorno
  if (envKey) {
    return {
      endpoint: envEndpoint || DEFAULT_ENDPOINT,
      apiKey: envKey,
      model: envModel || DEFAULT_MODEL,
      aspectRatio: "1:1",
      responseFormat: "url",
      n: 1,
      promptOptimizer: false,
      source: "env"
    };
  }
  // 3) Fallback: ai_config (legacy)
  const cfg = await getAiConfig();
  if (cfg.api_key) {
    return {
      endpoint: DEFAULT_ENDPOINT,
      apiKey: cfg.api_key,
      model: DEFAULT_MODEL,
      aspectRatio: "1:1",
      responseFormat: "url",
      n: 1,
      promptOptimizer: false,
      source: "fallback"
    };
  }
  return null;
}

export async function generateImage(
  input: ImageGenerationInput
): Promise<ImageGenerationResult> {
  const cfg = await resolveImageConfig();
  if (!cfg) {
    return {
      ok: false,
      provider: "minimax",
      model: "?",
      error:
        "No hay configuración de imagen. Configúrala en /admin/imagenes o define MINIMAX_API_KEY en Railway."
    };
  }

  const prompt = buildImagePrompt(input);
  // Prompt máximo 1500 caracteres según docs
  const trimmedPrompt = prompt.length > 1500 ? prompt.slice(0, 1497) + "..." : prompt;

  const body = {
    model: cfg.model,
    prompt: trimmedPrompt,
    aspect_ratio: cfg.aspectRatio,
    response_format: cfg.responseFormat,
    n: cfg.n,
    prompt_optimizer: cfg.promptOptimizer
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
      debug: { body_sent: body, source: cfg.source }
    };
  }

  const text = await response.text();
  let data: {
    data?: { image_urls?: string[]; image_base64?: string[] };
    metadata?: { success_count?: number; failed_count?: number };
    base_resp?: { status_code?: number; status_msg?: string };
    id?: string;
  };
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      error: `Respuesta no es JSON (HTTP ${response.status}): ${text.slice(0, 300)}`,
      debug: { body_sent: body, source: cfg.source }
    };
  }

  const statusCode = data.base_resp?.status_code;
  const statusMsg = data.base_resp?.status_msg;

  if (statusCode !== undefined && statusCode !== 0) {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode,
      errorCode: statusCode,
      error: `API error ${statusCode}: ${statusMsg ?? "unknown"} — ${explainStatusCode(statusCode)}`,
      debug: { body_sent: body, response: data, source: cfg.source }
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      provider: "minimax",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${text.slice(0, 300)}`,
      debug: { body_sent: body, response: data, source: cfg.source }
    };
  }

  const imageUrls = data.data?.image_urls;
  const imageB64 = data.data?.image_base64;

  if (imageUrls && imageUrls.length > 0) {
    return {
      ok: true,
      url: imageUrls[0],
      model: cfg.model,
      endpoint: cfg.endpoint,
      provider: "minimax",
      debug: {
        success_count: data.metadata?.success_count,
        failed_count: data.metadata?.failed_count,
        image_count: imageUrls.length
      }
    };
  }
  if (imageB64 && imageB64.length > 0) {
    return {
      ok: true,
      b64: imageB64[0],
      model: cfg.model,
      endpoint: cfg.endpoint,
      provider: "minimax",
      debug: {
        success_count: data.metadata?.success_count,
        failed_count: data.metadata?.failed_count,
        image_count: imageB64.length,
        note: "response_format=base64: se guardará directamente sin descarga"
      }
    };
  }

  return {
    ok: false,
    provider: "minimax",
    model: cfg.model,
    endpoint: cfg.endpoint,
    error: "La API no devolvió imágenes (ni urls ni base64)",
    debug: { response: data, source: cfg.source }
  };
}

function explainStatusCode(code: number): string {
  const map: Record<number, string> = {
    0: "OK",
    1002: "Rate limit — espera unos segundos y reintenta",
    1004: "API Key inválida o no autorizada",
    1008: "Saldo insuficiente en la cuenta",
    1026: "Prompt bloqueado por filtro de contenido",
    2013: "Parámetros inválidos",
    2049: "API Key inválida"
  };
  return map[code] ?? "código no documentado";
}

export type DbImageConfig = {
  has_db_config: boolean;
  db_config: ImageApiConfig | null;
  env_endpoint: string | null;
  env_model: string | null;
  has_env_key: boolean;
  resolved: ResolvedImageConfig | null;
};

export async function getImageConfigDiagnostics(): Promise<DbImageConfig> {
  const dbConfig = await getImageApiConfig();
  const resolved = await resolveImageConfig();
  return {
    has_db_config: Boolean(dbConfig?.api_key),
    db_config: dbConfig ? { ...dbConfig, api_key: dbConfig.api_key ? "***" : null } : null,
    env_endpoint: process.env.MINIMAX_IMAGE_ENDPOINT ?? null,
    env_model: process.env.MINIMAX_IMAGE_MODEL ?? null,
    has_env_key: Boolean(process.env.MINIMAX_API_KEY),
    resolved: resolved
      ? { ...resolved, apiKey: "***" }
      : null
  };
}

export type TestConnectionResult = {
  ok: boolean;
  endpoint: string;
  model: string;
  source: string;
  status_code?: number;
  status_msg?: string;
  image_count?: number;
  elapsed_ms?: number;
  error?: string;
  debug?: Record<string, unknown>;
};

export async function testImageConnection(): Promise<TestConnectionResult> {
  const cfg = await resolveImageConfig();
  if (!cfg) {
    return {
      ok: false,
      endpoint: "(no config)",
      model: "?",
      source: "none",
      error: "No hay configuración. Define api_key en /admin/imagenes o MINIMAX_API_KEY en Railway."
    };
  }
  const start = Date.now();
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        prompt: "A single small red dot on a white background, minimal, simple",
        aspect_ratio: cfg.aspectRatio,
        response_format: cfg.responseFormat,
        n: 1,
        prompt_optimizer: false
      }),
      signal: AbortSignal.timeout(30000)
    });
    const text = await res.text();
    const elapsed = Date.now() - start;
    let data: {
      data?: { image_urls?: string[]; image_base64?: string[] };
      metadata?: { success_count?: number; failed_count?: number };
      base_resp?: { status_code?: number; status_msg?: string };
    };
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        endpoint: cfg.endpoint,
        model: cfg.model,
        source: cfg.source,
        error: `HTTP ${res.status}: respuesta no es JSON`,
        elapsed_ms: elapsed,
        debug: { response_excerpt: text.slice(0, 300) }
      };
    }
    const sc = data.base_resp?.status_code ?? (res.ok ? 0 : res.status);
    const sm = data.base_resp?.status_msg ?? "";
    const imageCount = data.data?.image_urls?.length ?? data.data?.image_base64?.length ?? 0;
    return {
      ok: sc === 0 && imageCount > 0,
      endpoint: cfg.endpoint,
      model: cfg.model,
      source: cfg.source,
      status_code: sc,
      status_msg: sm,
      image_count: imageCount,
      elapsed_ms: elapsed,
      error: sc !== 0 ? `${explainStatusCode(sc)}` : imageCount === 0 ? "La API respondió OK pero no devolvió imágenes" : undefined,
      debug: { body_sent: { model: cfg.model, prompt: "(test prompt)", aspect_ratio: cfg.aspectRatio, response_format: cfg.responseFormat } }
    };
  } catch (err) {
    return {
      ok: false,
      endpoint: cfg.endpoint,
      model: cfg.model,
      source: cfg.source,
      error: err instanceof Error ? err.message : "Error de red",
      elapsed_ms: Date.now() - start
    };
  }
}

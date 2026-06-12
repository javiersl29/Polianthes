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
  /** Data URL (base64) de la imagen de la botella de la marca (sujeto principal) */
  brandBottleDataUrl?: string | null;
  /** Data URL (base64) del perfume original (referencia, ghost detrás) */
  originalPerfumeDataUrl?: string | null;
};

export type ImageGenerationResult = {
  ok: boolean;
  url?: string;
  b64?: string;
  mimeType?: string;
  revisedPrompt?: string;
  model: string;
  endpoint?: string;
  provider: ImageProvider | "mock";
  error?: string;
  errorCode?: number | string;
  statusCode?: number;
  referenceImageUrl?: string;
  referenceImageSource?: string;
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
  const hasBrandBottle = Boolean(input.brandBottleDataUrl);
  const hasOriginal = Boolean(input.originalPerfumeDataUrl);

  // Subject: la botella de marca Polianthes, nítida en primer plano
  const subjectLine = hasBrandBottle
    ? "In the foreground, sharply in focus and centered: the transparent crystal glass bottle of the Polianthes brand, with a polished golden cap, presented as the hero subject. Preserve the bottle's silhouette, proportions, glass clarity, cap finish, and label design exactly as in the reference."
    : "In the foreground, sharply in focus and centered: a clean transparent crystal glass perfume bottle with a polished golden cap, no visible label, logo, brand mark, or text. The bottle is the hero subject.";

  // Ref original: la botella fantasma de la fragancia original, borroso al fondo
  const refLine = hasOriginal
    ? "In the background, slightly out of focus and softly bokeh-blurred: a recognizable but ghosted presence of the original reference fragrance bottle, behind and to one side of the Polianthes bottle, as a soft colored silhouette, never sharp, never fully readable, only suggesting the original fragrance."
    : "";

  return [
    "Elegant, photorealistic, high-end perfumery campaign photography.",
    subjectLine,
    refLine,
    "Setting: the bottles rest on a polished marble tabletop with subtle veining, in a sophisticated dark wood shelf interior (boutique perfumery atmosphere).",
    "Lighting: warm golden key light from the upper left, soft amber fill, deep shadows to the right; cinematic chiaroscuro that highlights the crystal glass and the golden cap.",
    "Lens: 85mm prime, f/2.0, photorealistic, soft bokeh on the background, slight film grain, gentle reflections on the marble.",
    "Color palette: deep warm browns, polished gold accents, translucent glass with subtle internal reflections.",
    "Composition: hero subject in sharp focus, depth of field with strong background separation, no text overlay, no watermark, no UI elements, no logos other than the Polianthes label on the hero bottle.",
    familyHint ? `Fragrance family cues: ${familyHint}.` : "",
    moodHint ? `Atmosphere: ${moodHint}.` : "",
    allNotes ? `Subtle scent cues (background mood only, not literal): ${allNotes}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export type ImageProvider = "minimax" | "gemini" | "imagen" | "openai" | "replicate";

export type ImageApiConfig = {
  id: number;
  provider: ImageProvider;
  endpoint: string;
  api_key: string | null;
  model: string;
  aspect_ratio: string;
  response_format: "url" | "base64";
  prompt_optimizer: boolean;
  n: number;
  active: boolean;
  serpapi_api_key: string | null;
  gemini_api_key: string | null;
  updated_at: string;
};

export async function getImageApiConfig(): Promise<ImageApiConfig | null> {
  const r = await query<ImageApiConfig>(
    `SELECT id, COALESCE(provider, 'minimax') AS provider, endpoint, api_key, model, aspect_ratio, response_format,
            prompt_optimizer, n, active, serpapi_api_key, gemini_api_key, updated_at
     FROM image_api_config WHERE id = 1`
  );
  return r.rows[0] ?? null;
}

export type ResolvedImageConfig = {
  provider: ImageProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  aspectRatio: string;
  responseFormat: "url" | "base64";
  n: number;
  promptOptimizer: boolean;
  source: "db" | "env" | "fallback";
};

const DEFAULT_MINIMAX_ENDPOINT = "https://api.minimax.io/v1/image_generation";
const DEFAULT_MINIMAX_MODEL = "image-01";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-image";

/**
 * Resuelve la config de generación de imagen. Cada provider tiene su propia
 * key separada (gemini_api_key o api_key, según provider) y su env var
 * correspondiente.
 * - Gemini: gemini_api_key (DB) o GEMINI_API_KEY (env)
 * - MiniMax: api_key (DB) o MINIMAX_API_KEY (env)
 */
export async function resolveImageConfig(): Promise<ResolvedImageConfig | null> {
  const dbCfg = await getImageApiConfig();

  // Provider preferido: de la DB o inferido de qué env var existe
  const preferredProvider: ImageProvider =
    (dbCfg?.provider as ImageProvider) ||
    (process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.MINIMAX_API_KEY
      ? "minimax"
      : "minimax");

  // 1) DB con key específica del provider
  if (dbCfg && dbCfg.active) {
    if (preferredProvider === "gemini" && dbCfg.gemini_api_key) {
      return {
        provider: "gemini",
        endpoint: dbCfg.endpoint,
        apiKey: dbCfg.gemini_api_key,
        model: dbCfg.model,
        aspectRatio: dbCfg.aspect_ratio,
        responseFormat: "base64",
        n: dbCfg.n,
        promptOptimizer: false,
        source: "db"
      };
    }
    if (preferredProvider === "minimax" && dbCfg.api_key) {
      return {
        provider: "minimax",
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
  }

  // 2) Variables de entorno según provider
  if (preferredProvider === "gemini" && process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_MODEL}:generateContent`,
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_MODEL,
      aspectRatio: "1:1",
      responseFormat: "base64",
      n: 1,
      promptOptimizer: false,
      source: "env"
    };
  }
  if (process.env.MINIMAX_API_KEY) {
    return {
      provider: "minimax",
      endpoint: process.env.MINIMAX_IMAGE_ENDPOINT || DEFAULT_MINIMAX_ENDPOINT,
      apiKey: process.env.MINIMAX_API_KEY,
      model: process.env.MINIMAX_IMAGE_MODEL || DEFAULT_MINIMAX_MODEL,
      aspectRatio: "1:1",
      responseFormat: "url",
      n: 1,
      promptOptimizer: false,
      source: "env"
    };
  }

  // 3) Fallback: ai_config legacy (siempre MiniMax)
  const cfg = await getAiConfig();
  if (cfg.api_key) {
    return {
      provider: "minimax",
      endpoint: DEFAULT_MINIMAX_ENDPOINT,
      apiKey: cfg.api_key,
      model: DEFAULT_MINIMAX_MODEL,
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
        "No hay configuración de imagen. Configúrala en /admin/imagenes o define GEMINI_API_KEY / MINIMAX_API_KEY en Railway."
    };
  }

  const prompt = buildImagePrompt(input);
  const trimmedPrompt = prompt.length > 1500 ? prompt.slice(0, 1497) + "..." : prompt;

  // === DISPATCH POR PROVIDER ===
  if (cfg.provider === "gemini") {
    return generateWithGemini(input, trimmedPrompt, cfg);
  }
  // Por defecto: MiniMax (legacy)
  return generateWithMiniMax(input, trimmedPrompt, cfg);
}

/** ============= GEMINI ============= */
async function generateWithGemini(
  input: ImageGenerationInput,
  prompt: string,
  cfg: ResolvedImageConfig
): Promise<ImageGenerationResult> {
  const { generateGeminiImage, dataUrlToInline, resolveGeminiConfig } = await import("./gemini-image");
  const gcfg = resolveGeminiConfig({
    api_key: cfg.apiKey,
    model: cfg.model,
    aspect_ratio: cfg.aspectRatio
  });
  if (!gcfg) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      error: "No se pudo construir la config de Gemini"
    };
  }

  const refImages: { mimeType: string; data: string }[] = [];
  if (input.brandBottleDataUrl) {
    const r = dataUrlToInline(input.brandBottleDataUrl);
    if (r) refImages.push(r);
  }
  if (input.originalPerfumeDataUrl) {
    const r = dataUrlToInline(input.originalPerfumeDataUrl);
    if (r) refImages.push(r);
  }

  const r = await generateGeminiImage(
    {
      referenceImages: refImages,
      prompt,
      aspectRatio: cfg.aspectRatio,
      imageSize: cfg.n > 1 ? "1K" : "2K",
      thinkingLevel: "high"
    },
    gcfg
  );

  if (!r.ok) {
    return {
      ok: false,
      provider: "gemini",
      model: r.model,
      endpoint: r.endpoint,
      statusCode: r.statusCode,
      error: r.error,
      debug: r.debug
    };
  }
  return {
    ok: true,
    b64: r.imageBase64,
    mimeType: r.mimeType ?? "image/png",
    model: r.model,
    endpoint: r.endpoint,
    provider: "gemini",
    debug: { ...r.debug, mime_type: r.mimeType, thoughts: r.thoughts }
  };
}

/** ============= MINIMAX (legacy) ============= */
async function generateWithMiniMax(
  input: ImageGenerationInput,
  trimmedPrompt: string,
  cfg: ResolvedImageConfig
): Promise<ImageGenerationResult> {
  // image_reference (singular): solo UNA imagen de referencia. El modelo image-01
  // no acepta múltiples refs en la misma llamada (error 2013: image_reference must be one).
  let imageReference: { type: "character"; image_file: string } | null = null;
  if (input.brandBottleDataUrl) {
    imageReference = { type: "character", image_file: input.brandBottleDataUrl };
  } else if (input.originalPerfumeDataUrl) {
    imageReference = { type: "character", image_file: input.originalPerfumeDataUrl };
  }

  const body: Record<string, unknown> = {
    model: cfg.model,
    prompt: trimmedPrompt,
    aspect_ratio: cfg.aspectRatio,
    response_format: cfg.responseFormat,
    n: cfg.n,
    prompt_optimizer: cfg.promptOptimizer
  };
  if (imageReference) {
    body.image_reference = imageReference;
  }

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
        image_count: imageUrls.length,
        image_ref_used: imageReference ? "yes" : "no"
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
        image_ref_used: imageReference ? "yes" : "no",
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
    debug: { response: data, source: cfg.source, image_ref_used: imageReference ? "yes" : "no" }
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

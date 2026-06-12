/**
 * Integración con Google Gemini image generation.
 * Modelos soportados:
 * - gemini-3.1-flash-image (Nano Banana 2) — hasta 10 objetos + 4 personajes
 * - gemini-3-pro-image (Nano Banana Pro) — 6 objetos + 5 personajes, hasta 4K
 *
 * Soporta múltiples imágenes de referencia por llamada (hasta 14).
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

export type GeminiImageInput = {
  /** Data URL (base64) o https URL de cada imagen de referencia */
  referenceImages: { mimeType: string; data: string }[];
  prompt: string;
  aspectRatio?: string;
  imageSize?: "512" | "1K" | "2K" | "4K";
  thinkingLevel?: "minimal" | "high";
  includeThoughts?: boolean;
};

export type GeminiImageResult = {
  ok: boolean;
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  model: string;
  endpoint: string;
  provider: "gemini";
  error?: string;
  errorCode?: string;
  statusCode?: number;
  thoughts?: string;
  debug?: Record<string, unknown>;
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL = "gemini-3.1-flash-image";
const DEFAULT_ASPECT = "1:1";
const DEFAULT_SIZE = "1K";

/**
 * Valida la combinación aspect_ratio + image_size para gemini-3.1-flash-image.
 * Si la combinación no es válida, sube image_size a 1K (la opción más compatible).
 * Referencia: https://ai.google.dev/gemini-api/docs/image-generation
 *   - image_size=512 solo acepta 1:4, 4:1, 1:8, 8:1
 *   - 1K/2K/4K aceptan todos los aspect ratios
 */
function validateGeminiCombo(
  aspectRatio: string,
  imageSize: "512" | "1K" | "2K" | "4K"
): { aspectRatio: string; imageSize: "512" | "1K" | "2K" | "4K" } {
  const allowedAspectsFor512 = new Set(["1:4", "4:1", "1:8", "8:1"]);
  if (imageSize === "512" && !allowedAspectsFor512.has(aspectRatio)) {
    return { aspectRatio, imageSize: "1K" };
  }
  return { aspectRatio, imageSize };
}

export type ResolvedGeminiConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  aspectRatio: string;
  imageSize: "512" | "1K" | "2K" | "4K";
  thinkingLevel: "minimal" | "high";
  source: "db" | "env";
};

/**
 * Resuelve la configuración Gemini desde la DB (image_api_config) o env.
 * Acepta GEMINI_API_KEY como variable de entorno.
 */
export function resolveGeminiConfig(
  db: { api_key: string | null; model: string | null; aspect_ratio: string | null } | null
): ResolvedGeminiConfig | null {
  const envKey = process.env.GEMINI_API_KEY;
  const envModel = process.env.GEMINI_IMAGE_MODEL;
  if (db?.api_key) {
    return {
      endpoint: `${GEMINI_BASE}/${db.model || DEFAULT_MODEL}:generateContent`,
      apiKey: db.api_key,
      model: db.model || DEFAULT_MODEL,
      aspectRatio: db.aspect_ratio || DEFAULT_ASPECT,
      imageSize: "2K",
      thinkingLevel: "high",
      source: "db"
    };
  }
  if (envKey) {
    const model = envModel || DEFAULT_MODEL;
    return {
      endpoint: `${GEMINI_BASE}/${model}:generateContent`,
      apiKey: envKey,
      model,
      aspectRatio: DEFAULT_ASPECT,
      imageSize: "2K",
      thinkingLevel: "high",
      source: "env"
    };
  }
  return null;
}

/**
 * Genera una imagen con Gemini. Las referenceImages se envían como
 * partes inline_data antes del prompt, lo que permite al modelo usarlas
 * como referencias visuales.
 */
export async function generateGeminiImage(
  input: GeminiImageInput,
  cfg: ResolvedGeminiConfig
): Promise<GeminiImageResult> {
  const parts: unknown[] = [];
  for (const img of input.referenceImages) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.data }
    });
  }
  parts.push({ text: input.prompt });

  // Validar y auto-corregir la combinación image_size + aspect_ratio.
  // En gemini-3.1-flash-image, image_size=512 solo acepta 1:4, 4:1, 1:8, 8:1.
  // Para 1:1 (u otros) se requiere image_size >= 1K.
  const aspectRatio = input.aspectRatio ?? cfg.aspectRatio;
  const requestedSize = input.imageSize ?? cfg.imageSize;
  const { aspectRatio: validAspect, imageSize: validSize } = validateGeminiCombo(
    aspectRatio,
    requestedSize
  );

  const generationConfig: Record<string, unknown> = {
    response_modalities: ["TEXT", "IMAGE"],
    // IMPORTANTE: la API real (verificada con llamada directa) usa `imageConfig`
    // top-level con camelCase (aspectRatio, imageSize). El ejemplo de la doc en
    // español que muestra `response_format.image` con snake_case NO funciona
    // con gemini-3.1-flash-image actualmente y devuelve INVALID_ARGUMENT.
    imageConfig: {
      aspectRatio: validAspect,
      imageSize: validSize
    }
  };
  // Thinking config solo aplica a modelos 3.x
  if (cfg.model.includes("3") || cfg.model.includes("3.1") || cfg.model.includes("pro")) {
    generationConfig.thinking_config = {
      thinking_level: input.thinkingLevel ?? cfg.thinkingLevel,
      include_thoughts: input.includeThoughts ?? false
    };
  }
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig
  };

  let response: Response;
  try {
    response = await fetch(`${cfg.endpoint}?key=${cfg.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    });
  } catch (err) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: `No se pudo conectar: ${err instanceof Error ? err.message : "Error de red"}`,
      debug: { source: cfg.source }
    };
  }

  const text = await response.text();
  let data: {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
          // Acepta tanto camelCase (formato real de la API) como snake_case (defensivo)
          inlineData?: { mimeType: string; data: string };
          inline_data?: { mime_type: string; data: string };
          thought?: boolean;
        }[];
      };
      finish_reason?: string;
    }[];
    error?: { code: number; message: string; status: string };
  };
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      error: `HTTP ${response.status}: respuesta no es JSON`,
      debug: { response_excerpt: text.slice(0, 500) }
    };
  }

  if (data.error) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: data.error.code,
      errorCode: data.error.status,
      error: `${data.error.status}: ${data.error.message}`,
      debug: { response: data, source: cfg.source }
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${text.slice(0, 300)}`,
      debug: { response: data, source: cfg.source }
    };
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: "Gemini no devolvió candidatos",
      debug: { response: data }
    };
  }

  const responseParts = candidate.content?.parts ?? [];
  let imageBase64: string | undefined;
  let mimeType: string | undefined;
  let textOut: string | undefined;
  let thought: string | undefined;

  for (const part of responseParts) {
    if (part.thought) {
      if (part.text) thought = (thought ?? "") + part.text;
      continue;
    }
    // Acepta camelCase (formato real) o snake_case (defensivo)
    const imgData = part.inlineData ?? part.inline_data;
    if (imgData?.data) {
      imageBase64 = imgData.data;
      const anyImg = imgData as { mimeType?: string; mime_type?: string };
      mimeType = anyImg.mimeType ?? anyImg.mime_type ?? "image/png";
    } else if (part.text) {
      textOut = (textOut ?? "") + part.text;
    }
  }

  if (!imageBase64) {
    return {
      ok: false,
      provider: "gemini",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: "Gemini no devolvió imagen (puede haber sido bloqueada por safety)",
      thoughts: thought ?? textOut,
      debug: { finish_reason: candidate.finish_reason, parts: responseParts.length }
    };
  }

  return {
    ok: true,
    imageBase64,
    mimeType,
    text: textOut,
    thoughts: thought,
    model: cfg.model,
    endpoint: cfg.endpoint,
    provider: "gemini",
    debug: { finish_reason: candidate.finish_reason, source: cfg.source, refs_used: input.referenceImages.length }
  };
}

/**
 * Test de conexión: genera una imagen mínima de prueba.
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  endpoint: string;
  model: string;
  source: string;
  elapsed_ms: number;
  status_code?: number;
  error?: string;
}> {
  const cfg = resolveGeminiConfig(null);
  if (!cfg) {
    return {
      ok: false,
      endpoint: GEMINI_BASE,
      model: "?",
      source: "none",
      elapsed_ms: 0,
      error: "Sin GEMINI_API_KEY. Agrégala en la config o como env var."
    };
  }
  const start = Date.now();
  // Test simple: 1K + 1:1 es la combinación más compatible en gemini-3.1-flash-image.
  // (image_size=512 solo acepta 1:4, 4:1, 1:8, 8:1; 1:1 requiere >=1K)
  const r = await generateGeminiImage(
    {
      referenceImages: [],
      prompt: "A single small red dot on a white background, minimal, simple",
      aspectRatio: "1:1",
      imageSize: "1K",
      thinkingLevel: "minimal"
    },
    cfg
  );
  return {
    ok: r.ok,
    endpoint: cfg.endpoint,
    model: cfg.model,
    source: cfg.source,
    elapsed_ms: Date.now() - start,
    status_code: r.statusCode,
    error: r.error
  };
}

/**
 * Convierte un data URL (data:image/xxx;base64,YYY) a {mimeType, data}.
 */
export function dataUrlToInline(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

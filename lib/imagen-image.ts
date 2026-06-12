/**
 * Integración con Google Imagen 4 (text-to-image puro).
 * Endpoint: POST :predict (no :generateContent).
 * Modelos: imagen-4.0-generate-001 (Estándar), imagen-4.0-ultra-generate-001 (Ultra),
 *          imagen-4.0-fast-generate-001 (Rápido).
 * No acepta imágenes de referencia (a diferencia de Gemini native).
 * Docs: https://ai.google.dev/gemini-api/docs/imagen
 */

export type ImagenImageInput = {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "1K" | "2K";
  sampleCount?: number;
  personGeneration?: "dont_allow" | "allow_adult" | "allow_all";
};

export type ImagenImageResult = {
  ok: boolean;
  imageBase64?: string;
  mimeType?: string;
  model: string;
  endpoint: string;
  provider: "imagen";
  error?: string;
  errorCode?: string;
  statusCode?: number;
  debug?: Record<string, unknown>;
};

export type ResolvedImagenConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  source: "db" | "env";
};

/**
 * Resuelve la config de Imagen 4 desde la DB (image_api_config.model + gemini_api_key)
 * o env (GEMINI_API_KEY). Usa la misma key que Gemini.
 */
export function resolveImagenConfig(
  db: { api_key: string | null; model: string | null } | null
): ResolvedImagenConfig | null {
  if (db?.api_key) {
    return {
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${db.model || "imagen-4.0-generate-001"}:predict`,
      apiKey: db.api_key,
      model: db.model || "imagen-4.0-generate-001",
      source: "db"
    };
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    const envModel = process.env.IMAGEN_MODEL || "imagen-4.0-generate-001";
    return {
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${envModel}:predict`,
      apiKey: envKey,
      model: envModel,
      source: "env"
    };
  }
  return null;
}

export async function generateImagenImage(
  input: ImagenImageInput,
  cfg: ResolvedImagenConfig
): Promise<ImagenImageResult> {
  const body: Record<string, unknown> = {
    instances: [{ prompt: input.prompt }],
    parameters: {
      sampleCount: input.sampleCount ?? 1,
      aspectRatio: input.aspectRatio ?? "1:1",
      imageSize: input.imageSize ?? "1K",
      personGeneration: input.personGeneration ?? "allow_adult"
    }
  };
  let response: Response;
  try {
    response = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    });
  } catch (err) {
    return {
      ok: false,
      provider: "imagen",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: `No se pudo conectar: ${err instanceof Error ? err.message : "Error de red"}`
    };
  }
  const text = await response.text();
  let data: {
    predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
    error?: { code: number; message: string; status: string };
  };
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      provider: "imagen",
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
      provider: "imagen",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: data.error.code,
      errorCode: data.error.status,
      error: `${data.error.status}: ${data.error.message}`,
      debug: { response: data }
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      provider: "imagen",
      model: cfg.model,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${text.slice(0, 300)}`,
      debug: { response: data }
    };
  }
  const pred = data.predictions?.[0];
  if (!pred?.bytesBase64Encoded) {
    return {
      ok: false,
      provider: "imagen",
      model: cfg.model,
      endpoint: cfg.endpoint,
      error: "Imagen no devolvió imagen",
      debug: { response: data }
    };
  }
  return {
    ok: true,
    imageBase64: pred.bytesBase64Encoded,
    mimeType: pred.mimeType ?? "image/png",
    model: cfg.model,
    endpoint: cfg.endpoint,
    provider: "imagen",
    debug: { sample_count: data.predictions?.length ?? 0, source: cfg.source }
  };
}

export async function testImagenConnection(): Promise<{
  ok: boolean;
  endpoint: string;
  model: string;
  source: string;
  elapsed_ms: number;
  status_code?: number;
  error?: string;
}> {
  const cfg = resolveImagenConfig(null);
  if (!cfg) {
    return {
      ok: false,
      endpoint: "(no config)",
      model: "?",
      source: "none",
      elapsed_ms: 0,
      error: "Sin GEMINI_API_KEY. Agrégala en la config o como env var."
    };
  }
  const start = Date.now();
  const r = await generateImagenImage(
    { prompt: "A single small red dot on a white background, minimal, simple", aspectRatio: "1:1", imageSize: "1K" },
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

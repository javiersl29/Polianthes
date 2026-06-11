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
  url?: string;
  b64?: string;
  revisedPrompt?: string;
  model: string;
  provider: "minimax" | "mock";
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

export function resolveImageEndpoint(baseUrl: string | null | undefined): string {
  const url = (baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${url}/images/generations`;
}

export async function generateImage(
  input: ImageGenerationInput
): Promise<ImageGenerationResult> {
  const cfg = await getAiConfig();
  if (!cfg.api_key) {
    return mockResult(input, "Falta API key en Configuración IA");
  }
  const prompt = buildImagePrompt(input);
  const model = process.env.MINIMAX_IMAGE_MODEL || "minimax-image-01";
  const response = await fetch(resolveImageEndpoint(cfg.base_url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.api_key}`
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url"
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image API ${response.status}: ${text.slice(0, 400)}`);
  }
  const data = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    model?: string;
  };
  const first = data.data?.[0];
  if (!first) {
    throw new Error("La API no devolvió imágenes");
  }
  return {
    url: first.url,
    b64: first.b64_json,
    revisedPrompt: first.revised_prompt,
    model: data.model ?? model,
    provider: "minimax"
  };
}

function mockResult(input: ImageGenerationInput, reason: string): ImageGenerationResult {
  return {
    model: "mock",
    provider: "mock",
    revisedPrompt: `[MOCK] ${reason}. Prompt construido para "${input.fragranceName}" (${input.family ?? "n/d"}).`
  };
}

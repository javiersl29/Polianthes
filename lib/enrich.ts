import { searchWeb, formatHitsForPrompt, SearchResult } from "./search";
import { chatCompletion } from "./llm";
import { AiConfig } from "./ai-config";
import { clamp01to100, FAMILY_AXES, MOOD_AXES } from "./vectors";

export type EnrichmentInput = {
  brand: string;
  name: string;
  full_name: string;
};

export type EnrichmentResult = {
  description: string | null;
  family: string | null;
  mood: string | null;
  gender: "hombre" | "mujer" | "unisex";
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  family_axes: Record<string, number>;
  mood_axes: Record<string, number>;
  vector_justification: Record<string, unknown>;
  provider: string;
  search_hits: number;
  used_fallback: boolean;
  raw_llm?: string;
};

const STRICT_JSON_SYSTEM = `Eres el perfumista documentalista de Polianthes. Tu trabajo es describir una fragancia con la mayor fidelidad posible a su composición aromática real.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma EXACTA (sin texto antes ni después, sin bloques markdown, sin comentarios):

{
  "description": "1-2 frases evocadoras en español sobre el carácter del perfume",
  "family": "una de: Floral | Oriental | Amaderado | Chipre | Cítrico | Gourmand",
  "mood": "una palabra evocadora en español",
  "gender": "hombre | mujer | unisex",
  "top_notes": ["nota1", "nota2"],
  "heart_notes": ["nota1", "nota2"],
  "base_notes": ["nota1", "nota2"],
  "family_axes": {
    "floral": 0,
    "oriental": 0,
    "amaderado": 0,
    "chipre": 0,
    "citrico": 0,
    "gourmand": 0
  },
  "mood_axes": {
    "frescura": 0,
    "misterio": 0,
    "romantico": 0,
    "energia": 0,
    "sofisticado": 0,
    "nostalgico": 0
  }
}

Reglas:
- Notas en español, máximo 5 por capa.
- gender: 'pour homme' o nombres típicamente masculinos → hombre; '(Mujer)' o nombres femeninos → mujer; el resto → unisex.
- Vectores (family_axes, mood_axes) puntúan 0-100 la composición aromática real:
  * 0 = ausente
  * 1-30 = rastro/trasfondo
  * 31-60 = presente
  * 61-85 = dominante
  * 86-100 = hegemónico
- Cada fragancia tiene 1-2 ejes altos (60-90), 1-2 medios (30-60) y el resto bajos (5-25).
- Sé leal: si es un cítrico, citrico≈85; si tiene sándalo/oud, amaderado≈70 y oriental≈50; si es gourmand, gourmand≈80.
- No inventes vectores nulos: rellena los 12 valores.`;

const RETRY_HINT = "\n\nIMPORTANTE: tu respuesta anterior omitió los vectores (family_axes y mood_axes) o los dejó vacíos. Esta vez DEBES incluir los 12 valores numéricos 0-100. Responde SOLO con el JSON completo, sin texto fuera.";

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function hasAllVectors(data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  const fa = (data.family_axes ?? {}) as Record<string, unknown>;
  const ma = (data.mood_axes ?? {}) as Record<string, unknown>;
  const familyKeys = FAMILY_AXES.map((a) => a.id);
  const moodKeys = MOOD_AXES.map((a) => a.id);
  const faValid = familyKeys.every((k) => typeof fa[k] === "number" && Number.isFinite(fa[k]));
  const maValid = moodKeys.every((k) => typeof ma[k] === "number" && Number.isFinite(ma[k]));
  return faValid && maValid;
}

function deterministicVectors(family: string | null, mood: string | null): {
  family_axes: Record<string, number>;
  mood_axes: Record<string, number>;
} {
  // Mapa base por familia. Es un fallback honesto: un "Floral" no puede ser 0 en floral.
  const familyDefaults: Record<string, Record<string, number>> = {
    Floral: { floral: 80, oriental: 30, amaderado: 25, chipre: 20, citrico: 25, gourmand: 20 },
    Oriental: { floral: 25, oriental: 80, amaderado: 50, chipre: 25, citrico: 10, gourmand: 50 },
    Amaderado: { floral: 15, oriental: 45, amaderado: 80, chipre: 35, citrico: 15, gourmand: 20 },
    Chipre: { floral: 30, oriental: 35, amaderado: 45, chipre: 80, citrico: 20, gourmand: 15 },
    Citrico: { floral: 20, oriental: 10, amaderado: 15, chipre: 10, citrico: 85, gourmand: 10 },
    Gourmand: { floral: 20, oriental: 55, amaderado: 30, chipre: 15, citrico: 10, gourmand: 80 }
  };
  const family_axes = { ...(familyDefaults[family ?? ""] ?? familyDefaults.Floral) };
  // Mood determinístico a partir de palabras clave
  const moodMap: Record<string, Record<string, number>> = {
    misterio: { frescura: 15, misterio: 80, romantico: 55, energia: 25, sofisticado: 65, nostalgico: 40 },
    romantico: { frescura: 25, misterio: 50, romantico: 85, energia: 30, sofisticado: 60, nostalgico: 55 },
    energia: { frescura: 55, misterio: 15, romantico: 30, energia: 85, sofisticado: 35, nostalgico: 10 },
    sofisticado: { frescura: 35, misterio: 50, romantico: 40, energia: 30, sofisticado: 85, nostalgico: 30 },
    nostalgia: { frescura: 20, misterio: 50, romantico: 55, energia: 15, sofisticado: 55, nostalgico: 80 },
    nostalgia_: { frescura: 20, misterio: 50, romantico: 55, energia: 15, sofisticado: 55, nostalgico: 80 },
    fresco: { frescura: 85, misterio: 10, romantico: 25, energia: 60, sofisticado: 40, nostalgico: 15 },
    fresco_: { frescura: 85, misterio: 10, romantico: 25, energia: 60, sofisticado: 40, nostalgico: 15 }
  };
  const key = (mood ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mood_axes = { ...(moodMap[key] ?? { frescura: 50, misterio: 50, romantico: 50, energia: 50, sofisticado: 50, nostalgico: 50 }) };
  return { family_axes, mood_axes };
}

export async function enrichFragrance(
  config: Pick<AiConfig, "api_key" | "base_url" | "model" | "temperature">,
  input: EnrichmentInput
): Promise<EnrichmentResult> {
  // 1) Búsqueda web para mejorar la fidelidad
  const search = await searchWeb(`${input.brand} ${input.name} perfume notes composition`, 5);
  const searchContext = formatHitsForPrompt(search);

  const baseUser = searchContext
    ? `Fragancia a documentar: ${input.full_name}\n\nInformación de referencia (búsqueda web):\n${searchContext}\n\nUsa la información anterior si está disponible, complétala con tu conocimiento y devuelve el JSON estricto con los 12 vectores.`
    : `Fragancia a documentar: ${input.full_name}\n\nNo hay información de búsqueda disponible. Basa tu análisis en tu conocimiento sobre esta fragancia, su maison, perfumista y convenciones de la familia olfativa. Devuelve el JSON estricto con los 12 vectores.`;

  let parsed: Record<string, unknown> | null = null;
  let rawText = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const systemPrompt = attempt === 0 ? STRICT_JSON_SYSTEM : STRICT_JSON_SYSTEM + RETRY_HINT;
    const completion = await chatCompletion(
      { ...config, temperature: attempt === 0 ? 0.4 : 0.2 },
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: baseUser }
      ]
    );
    rawText = completion.text;
    parsed = safeParse(rawText);
    if (hasAllVectors(parsed)) break;
  }

  let usedFallback = false;
  if (!parsed) {
    // eslint-disable-next-line no-console
    console.error(`[enrich] LLM no devolvió JSON parseable para ${input.full_name}. raw=`, rawText.slice(0, 500));
    parsed = {};
  }
  if (!hasAllVectors(parsed)) {
    // eslint-disable-next-line no-console
    console.warn(`[enrich] LLM omitió vectores para ${input.full_name}. Aplicando fallback determinístico. raw=`, rawText.slice(0, 500));
    usedFallback = true;
  }

  const fa = (parsed.family_axes ?? {}) as Record<string, unknown>;
  const ma = (parsed.mood_axes ?? {}) as Record<string, unknown>;
  const familyRaw = typeof parsed.family === "string" ? parsed.family : null;
  const moodRaw = typeof parsed.mood === "string" ? parsed.mood : null;
  const fallbackVecs = hasAllVectors(parsed) ? null : deterministicVectors(familyRaw, moodRaw);
  const family_axes: Record<string, number> = {};
  for (const axis of FAMILY_AXES) {
    family_axes[axis.id] = hasAllVectors(parsed) ? clamp01to100(fa[axis.id]) : fallbackVecs!.family_axes[axis.id];
  }
  const mood_axes: Record<string, number> = {};
  for (const axis of MOOD_AXES) {
    mood_axes[axis.id] = hasAllVectors(parsed) ? clamp01to100(ma[axis.id]) : fallbackVecs!.mood_axes[axis.id];
  }

  const gender: "hombre" | "mujer" | "unisex" =
    parsed.gender === "hombre" || parsed.gender === "mujer" ? parsed.gender : "unisex";

  return {
    description: typeof parsed.description === "string" ? parsed.description : null,
    family: familyRaw,
    mood: moodRaw,
    gender,
    top_notes: Array.isArray(parsed.top_notes) ? (parsed.top_notes as unknown[]).filter((x): x is string => typeof x === "string") : [],
    heart_notes: Array.isArray(parsed.heart_notes) ? (parsed.heart_notes as unknown[]).filter((x): x is string => typeof x === "string") : [],
    base_notes: Array.isArray(parsed.base_notes) ? (parsed.base_notes as unknown[]).filter((x): x is string => typeof x === "string") : [],
    family_axes,
    mood_axes,
    vector_justification: {
      family_axes_raw: fa,
      mood_axes_raw: ma,
      used_fallback: usedFallback,
      search_provider: search.provider,
      search_query: search.query,
      search_hits: search.hits.length
    },
    provider: search.provider,
    search_hits: search.hits.length,
    used_fallback: usedFallback,
    raw_llm: rawText.slice(0, 2000)
  };
}

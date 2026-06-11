import { Gender } from "./fragrances";

export type FamilyAxes = {
  floral: number;
  oriental: number;
  amaderado: number;
  chipre: number;
  citrico: number;
  gourmand: number;
};

export type MoodAxes = {
  frescura: number;
  misterio: number;
  romantico: number;
  energia: number;
  sofisticado: number;
  nostalgico: number;
};

export const FAMILY_AXES: { id: keyof FamilyAxes; label: string; hint: string }[] = [
  { id: "floral", label: "Floral", hint: "Rosa, jazmín, peonía" },
  { id: "oriental", label: "Oriental", hint: "Ámbar, vainilla, especias" },
  { id: "amaderado", label: "Amaderado", hint: "Sándalo, cedro, vetiver" },
  { id: "chipre", label: "Chipre", hint: "Musgo de roble, pachulí" },
  { id: "citrico", label: "Cítrico", hint: "Bergamota, mandarina, pomelo" },
  { id: "gourmand", label: "Gourmand", hint: "Caramelo, café, cacao" }
];

export const MOOD_AXES: { id: keyof MoodAxes; label: string; hint: string }[] = [
  { id: "frescura", label: "Frescura", hint: "Limpio, ligero, diario" },
  { id: "misterio", label: "Misterio", hint: "Noche, profundidad" },
  { id: "romantico", label: "Romántico", hint: "Sensual, envolvente" },
  { id: "energia", label: "Energía", hint: "Vibrante, juvenil" },
  { id: "sofisticado", label: "Sofisticado", hint: "Pulcro, editorial" },
  { id: "nostalgico", label: "Nostálgico", hint: "Evocador, íntimo" }
];

export type AxisSet = "familias" | "mood";

export const FAMILIA_COLUMN_MAP: Record<keyof FamilyAxes, string> = {
  floral: "vec_floral",
  oriental: "vec_oriental",
  amaderado: "vec_amaderado",
  chipre: "vec_chipre",
  citrico: "vec_citrico",
  gourmand: "vec_gourmand"
};

export const MOOD_COLUMN_MAP: Record<keyof MoodAxes, string> = {
  frescura: "vec_frescura",
  misterio: "vec_misterio",
  romantico: "vec_romantico",
  energia: "vec_energia",
  sofisticado: "vec_sofisticado",
  nostalgico: "vec_nostalgico"
};

export type FragranceVectorRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  family_axes: FamilyAxes;
  mood_axes: MoodAxes;
};

export function clamp01to100(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseFamilyAxes(row: Record<string, unknown>): FamilyAxes {
  return {
    floral: clamp01to100(row.vec_floral),
    oriental: clamp01to100(row.vec_oriental),
    amaderado: clamp01to100(row.vec_amaderado),
    chipre: clamp01to100(row.vec_chipre),
    citrico: clamp01to100(row.vec_citrico),
    gourmand: clamp01to100(row.vec_gourmand)
  };
}

export function parseMoodAxes(row: Record<string, unknown>): MoodAxes {
  return {
    frescura: clamp01to100(row.vec_frescura),
    misterio: clamp01to100(row.vec_misterio),
    romantico: clamp01to100(row.vec_romantico),
    energia: clamp01to100(row.vec_energia),
    sofisticado: clamp01to100(row.vec_sofisticado),
    nostalgico: clamp01to100(row.vec_nostalgico)
  };
}

export function affinity(client: Record<string, number>, fragrance: Record<string, number>): number {
  // Cosine similarity en 0..1, devuelta como porcentaje 0..100.
  const keys = Object.keys(client);
  let dot = 0;
  let magClient = 0;
  let magFrag = 0;
  for (const k of keys) {
    const c = client[k] ?? 0;
    const f = fragrance[k] ?? 0;
    dot += c * f;
    magClient += c * c;
    magFrag += f * f;
  }
  if (magClient === 0 || magFrag === 0) return 0;
  return Math.round((dot / (Math.sqrt(magClient) * Math.sqrt(magFrag))) * 100);
}

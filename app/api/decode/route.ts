import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion, extractFirstJson } from "@/lib/llm";
import { affinity } from "@/lib/vectors";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
  mode?: "fast" | "rich";
  count?: number;
  reference_slug?: string;
};

const FAMILY_COLUMNS = ["vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand"];
const MOOD_COLUMNS = ["vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"];
const ALL_VEC_COLUMNS = [...FAMILY_COLUMNS, ...MOOD_COLUMNS];

const SELECT_LIST = ["id", "slug", "brand", "name", "full_name", "family", "mood", "gender", "image_url", "top_notes", "heart_notes", "base_notes"].join(", ");

const FAST_REASONS = [
  "Afin a tu vector numérico.",
  "Tu afinidad es alta en este perfil.",
  "Corresponde bien a la dirección que marcas.",
  "Coincidencia sólida con tus ejes.",
  "Tu firma olfativa resuena aquí."
];

type TopItem = { f: { id: number; slug: string; brand: string; name: string; full_name: string; family: string | null; mood: string | null; gender: Gender; image_url: string | null; [k: string]: unknown }; score: number };

function buildFallbackReflection(
  vector: Record<string, number>,
  setId: "familias" | "mood",
  gender: Gender,
  topItems: TopItem[]
): string {
  const entries = Object.entries(vector).filter(([, v]) => v > 50);
  entries.sort((a, b) => b[1] - a[1]);
  const dominant = entries[0]?.[0] ?? "";
  const familyLabel: Record<string, string> = {
    floral: "floral", oriental: "oriental", amaderado: "amaderado", chipre: "chipre",
    citrico: "cítrico", gourmand: "gourmand", frescura: "fresco", misterio: "misterioso",
    romantico: "romántico", energia: "enérgico", sofisticado: "sofisticado", nostalgico: "nostálgico"
  };
  const domLabel = familyLabel[dominant] ?? "definido";
  const perfil = gender === "hombre" ? "un hombre" : gender === "mujer" ? "una mujer" : "una persona";
  const top3 = topItems.slice(0, 3).map((c) => `${c.f.brand} ${c.f.name}`).join(", ");
  return `${perfil.charAt(0).toUpperCase() + perfil.slice(1)} con un perfil ${domLabel} en la curaduría. Esta selección reune fragancias que comparten esa dirección: ${top3}, entre otras. Cada una abre con notas de salida definidas, evoluciona por un corazón característico y descansa en un fondo que las hace reconocibles.`;
}

function buildReferenceReflection(
  refName: string,
  topItems: TopItem[]
): string {
  const top3 = topItems.slice(0, 3).map((c) => `${c.f.brand} ${c.f.name}`).join(", ");
  return `Si ${refName} define tu gusto, esta selección comparte su misma composición aromática: ${top3}, entre otras. Cada una mantiene el ADN olfativo que reconoces, con matices que sorprenden.`;
}

function buildFastReflection(
  vector: Record<string, number>,
  gender: Gender,
  topItems: TopItem[]
): string {
  const entries = Object.entries(vector).filter(([, v]) => v > 50);
  entries.sort((a, b) => b[1] - a[1]);
  const top2 = entries.slice(0, 2);
  const familyLabel: Record<string, string> = {
    floral: "floral", oriental: "oriental", amaderado: "amaderado", chipre: "chipre",
    citrico: "cítrico", gourmand: "gourmand", frescura: "fresco", misterio: "misterioso",
    romantico: "romántico", energia: "enérgico", sofisticado: "sofisticado", nostalgico: "nostálgico"
  };
  const profile = top2.length === 0
    ? "equilibrado"
    : top2.length === 1
      ? familyLabel[top2[0][0]] ?? "definido"
      : `${familyLabel[top2[0][0]] ?? "definido"} con acentos ${familyLabel[top2[1][0]] ?? "complementarios"}`;
  const perfil = gender === "hombre" ? "un hombre" : gender === "mujer" ? "una mujer" : "una persona";
  const topNames = topItems.slice(0, 3).map((c) => `${c.f.brand} ${c.f.name}`).join(", ");
  return `Selección rápida: ${perfil} con perfil ${profile}. Polianthes identificó afinidad numérica con ${topNames}, entre otras. Esta es la lectura objetiva de tus ejes — para una justificación editorial, prueba la decodificación con IA.`;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const count = Math.max(1, Math.min(10, body.count ?? 5));
  const gender: Gender = body.gender === "hombre" || body.gender === "mujer" ? body.gender : "unisex";
  const mode: "fast" | "rich" = body.mode === "rich" ? "rich" : "fast";

  const pool = getPool();

  let effectiveVector = body.vector;
  let setId: "familias" | "mood" = body.set;
  let referenceName: string | null = null;

  if (body.reference_slug) {
    const refResult = await pool.query(
      `SELECT slug, brand, name, full_name, ${ALL_VEC_COLUMNS.map((c) => `"${c}"`).join(", ")} FROM fragrance WHERE slug = $1 AND active = TRUE`,
      [body.reference_slug]
    );
    if (refResult.rows.length === 0) {
      return NextResponse.json({ error: "Fragancia de referencia no encontrada." }, { status: 404 });
    }
    const ref = refResult.rows[0];
    referenceName = ref.full_name;

    const familyVec: Record<string, number> = {};
    for (const col of FAMILY_COLUMNS) {
      familyVec[col.replace("vec_", "")] = Number(ref[col] ?? 50);
    }
    const moodVec: Record<string, number> = {};
    for (const col of MOOD_COLUMNS) {
      moodVec[col.replace("vec_", "")] = Number(ref[col] ?? 50);
    }

    effectiveVector = { ...familyVec, ...moodVec };
    setId = body.set || "familias";
  }

  const set = HEXAGON_SETS[setId];
  if (!set) return NextResponse.json({ error: "Set no válido" }, { status: 400 });

  const cols = setId === "familias" ? FAMILY_COLUMNS : MOOD_COLUMNS;
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  const genderClause = gender === "unisex" ? "" : "AND (gender = $1 OR gender = 'unisex')";
  const excludeRef = body.reference_slug ? `AND slug != '${body.reference_slug.replace(/'/g, "''")}'` : "";
  const result = await pool.query(
    `SELECT ${SELECT_LIST}, ${colsSql} FROM fragrance WHERE active = TRUE ${genderClause} ${excludeRef}`,
    gender === "unisex" ? [] : [gender]
  );
  type Row = {
    id: number; slug: string; brand: string; name: string; full_name: string;
    family: string | null; mood: string | null; gender: Gender; image_url: string | null;
    [k: string]: unknown;
  };
  const rows = result.rows as Row[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "El catálogo está vacío." }, { status: 503 });
  }

  const clientVecForRanking = setId === "familias"
    ? Object.fromEntries(FAMILY_COLUMNS.map((c) => [c.replace("vec_", ""), effectiveVector[c.replace("vec_", "")] ?? 50]))
    : Object.fromEntries(MOOD_COLUMNS.map((c) => [c.replace("vec_", ""), effectiveVector[c.replace("vec_", "")] ?? 50]));

  const ranked = rows
    .map((f) => {
      const fragVec: Record<string, number> = {};
      for (const col of cols) {
        const id = col.replace("vec_", "");
        fragVec[id] = Number(f[col] ?? 50);
      }
      const score = affinity(clientVecForRanking, fragVec);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, Math.max(count + 1, 6));
  if (top.length === 0) {
    return NextResponse.json({ error: "No hay fragancias que coincidan." }, { status: 404 });
  }

  // MODO FAST: razones con notas reales + mini-reflexión
  if (mode === "fast") {
    const recommendations = top.slice(0, count).map((c) => {
      let reason: string;
      if (referenceName) {
        const notes = [
          ...((c.f.top_notes as string[] | null) ?? []).slice(0, 2),
          ...((c.f.heart_notes as string[] | null) ?? []).slice(0, 1)
        ];
        const noteText = notes.length > 0 ? ` —notas de ${notes.join(", ")}` : "";
        reason = `Comparte composición aromática con ${referenceName}${noteText}.`;
      } else {
        const heart = (c.f.heart_notes as string[] | null) ?? [];
        const base = (c.f.base_notes as string[] | null) ?? [];
        const accent = heart.length > 0 ? heart[0] : base.length > 0 ? base[0] : null;
        const familyText = c.f.family ? `${c.f.family} ` : "";
        reason = accent
          ? `Composición ${familyText}con ${accent} como corazón. Afinidad ${c.score}%.`
          : `Perfil ${familyText}alineado a tu vector. Afinidad ${c.score}%.`;
      }
      return { ...c.f, reason, score: c.score };
    });

    const fastReflection = referenceName
      ? buildReferenceReflection(referenceName, top)
      : buildFastReflection(clientVecForRanking, gender, top);

    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      recommendations,
      reflection: fastReflection,
      elapsed_ms: elapsed,
      mode: "fast",
      reference: referenceName
    });
  }

  // MODO RICH
  const compactList = top
    .map((c, i) => `${i + 1}. ${c.f.brand} ${c.f.name} | ${c.f.slug} | ${c.score}% | ${c.f.family ?? ""} | ${c.f.mood ?? ""}`)
    .join("\n");

  const vectorText = set.axes
    .map((a) => `${a.label}=${effectiveVector[a.id] ?? 50}`)
    .join(", ");

  const richSystem =
    "Eres el curador humano de Polianthes. Hablas en español, con voz segura, cálida y editorial. " +
    "Tu única salida es un objeto JSON estricto (sin markdown, sin ```thinking```, sin texto extra). " +
    "Estructura: " +
    '{"r":[{"s":"slug","w":"frase ≤ 14 palabras, evocadora y humana"}],' +
    '"f":"texto de 2-3 frases (≤ 90 palabras) que: (1) describe al cliente en 2-3 palabras o una imagen breve; (2) describe la selección con sus tipos de perfume y composición (notas de salida, corazón, fondo); (3) conecta los perfumes con el perfil del cliente en una sola frase final. Tono editorial, no de marketing. NO incluyas la palabra Inspiración en este texto."}';

  const refContext = referenceName ? `\nReferencia del cliente: "${referenceName}" — le gusta esta fragancia y busca otras con composición aromática similar.` : "";
  const richUser = `Set: ${setId}\nVector del cliente: ${vectorText}\nGénero: ${gender}\nCantidad solicitada: ${count}${refContext}\nCandidatos:\n${compactList}`;

  try {
    const config = await configReadyOrThrow();
    const completion = await chatCompletion(config, [
      { role: "system", content: richSystem },
      { role: "user", content: richUser }
    ]);
    const text = completion.text.trim();
    const safe = extractFirstJson(text);
    if (!safe) throw new Error("La IA no devolvió un JSON válido");
    const parsed = JSON.parse(safe) as {
      r?: { s: string; w: string }[];
      f?: string;
    };

    const pickedRaw = parsed.r ?? [];
    const picked = pickedRaw
      .map((p) => ({ slug: p.s ?? "", reason: p.w ?? "" }))
      .filter((p) => p.slug)
      .slice(0, count);

    const recommendations = picked
      .map((p) => {
        const found = top.find((c) => c.f.slug === p.slug);
        if (!found) return null;
        return { ...found.f, reason: p.reason, score: found.score };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (recommendations.length < count) {
      for (const cand of top) {
        if (recommendations.length >= count) break;
        if (recommendations.find((r) => r.slug === cand.f.slug)) continue;
        const heart = (cand.f.heart_notes as string[] | null) ?? [];
        const accent = heart[0] ?? null;
        const fallbackReason = referenceName
          ? `Comparte composición con ${referenceName}.`
          : accent
            ? `Composición con ${accent} como corazón. Afinidad ${cand.score}%.`
            : `Afinidad numérica ${cand.score}% con tu vector.`;
        recommendations.push({ ...cand.f, reason: fallbackReason, score: cand.score });
      }
    }

    const reflection =
      (parsed.f ?? "").trim() || (referenceName
        ? buildReferenceReflection(referenceName, top)
        : buildFallbackReflection(effectiveVector, setId, gender, top));

    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      recommendations: recommendations.slice(0, count),
      reflection,
      elapsed_ms: elapsed,
      mode: "rich",
      reference: referenceName
    });
  } catch (err) {
    const recommendations = top.slice(0, count).map((c) => {
      const heart = (c.f.heart_notes as string[] | null) ?? [];
      const accent = heart[0] ?? null;
      const reason = referenceName
        ? `Comparte composición con ${referenceName}.`
        : accent
          ? `Composición con ${accent} como corazón. Afinidad ${c.score}%.`
          : `Afinidad numérica ${c.score}% con tu vector.`;
      return { ...c.f, reason, score: c.score };
    });
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      recommendations,
      reflection: referenceName
        ? buildReferenceReflection(referenceName, top)
        : buildFastReflection(clientVecForRanking, gender, top),
      elapsed_ms: elapsed,
      mode: "fallback",
      reference: referenceName,
      warning: err instanceof Error ? err.message : ""
    });
  }
}

async function configReadyOrThrow() {
  const c = await getAiConfig();
  if (!c.api_key) throw new Error("API key no configurada");
  return c;
}

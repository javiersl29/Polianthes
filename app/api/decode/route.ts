import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { affinity } from "@/lib/vectors";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
  count?: number;
  reference_slug?: string;
};

const FAMILY_COLUMNS = ["vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand"];
const MOOD_COLUMNS = ["vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"];
const ALL_VEC_COLUMNS = [...FAMILY_COLUMNS, ...MOOD_COLUMNS];

const SELECT_LIST = ["id", "slug", "brand", "name", "full_name", "family", "mood", "gender", "image_url", "display_code", "artistic_name", "inspired_by_name", "inspired_by_brand", "top_notes", "heart_notes", "base_notes"].join(", ");

type Row = {
  id: number; slug: string; brand: string; name: string; full_name: string;
  family: string | null; mood: string | null; gender: Gender; image_url: string | null;
  display_code: string | null; artistic_name: string | null;
  inspired_by_name: string | null; inspired_by_brand: string | null;
  top_notes: string[] | null; heart_notes: string[] | null; base_notes: string[] | null;
  [k: string]: unknown;
};

const FAMILY_LABEL: Record<string, string> = {
  floral: "floral", oriental: "oriental", amaderado: "amaderado", chipre: "chipre",
  citrico: "cítrico", gourmand: "gourmand", frescura: "fresco", misterio: "misterioso",
  romantico: "romántico", energia: "enérgico", sofisticado: "sofisticado", nostalgico: "nostálgico"
};

function buildReason(c: Row, referenceName: string | null): string {
  const heart = c.heart_notes ?? [];
  const top = c.top_notes ?? [];
  const base = c.base_notes ?? [];
  const accent = heart[0] ?? top[0] ?? base[0] ?? null;
  const familyText = c.family ? `${c.family} ` : "";

  if (referenceName) {
    const noteList = [
      ...top.slice(0, 2),
      ...heart.slice(0, 1)
    ].filter(Boolean);
    const noteText = noteList.length > 0 ? ` —notas de ${noteList.join(", ")}` : "";
    return `Comparte composición aromática con ${referenceName}${noteText}.`;
  }
  if (accent) {
    return `Composición ${familyText}con ${accent} como corazón. Afinidad ${c.score}%.`;
  }
  return `Perfil ${familyText}alineado a tu vector. Afinidad ${c.score}%.`;
}

function buildReflection(
  vector: Record<string, number>,
  setId: "familias" | "mood",
  gender: Gender,
  topItems: { f: Row; score: number }[],
  referenceName: string | null
): string {
  if (referenceName) {
    const top3 = topItems.slice(0, 3).map((c) => `${c.f.brand} ${c.f.name}`).join(", ");
    return `Si ${referenceName} define tu gusto, esta selección comparte su misma composición aromática: ${top3}, entre otras. Cada una mantiene el ADN olfativo que reconoces, con matices que sorprenden.`;
  }
  const entries = Object.entries(vector).filter(([, v]) => v > 50);
  entries.sort((a, b) => b[1] - a[1]);
  const top2 = entries.slice(0, 2);
  const profile = top2.length === 0
    ? "equilibrado"
    : top2.length === 1
      ? FAMILY_LABEL[top2[0][0]] ?? "definido"
      : `${FAMILY_LABEL[top2[0][0]] ?? "definido"} con acentos ${FAMILY_LABEL[top2[1][0]] ?? "complementarios"}`;
  const perfil = gender === "hombre" ? "un hombre" : gender === "mujer" ? "una mujer" : "una persona";
  const topNames = topItems.slice(0, 3).map((c) => `${c.f.brand} ${c.f.name}`).join(", ");
  return `Selección curada para ${perfil} con perfil ${profile}. Polianthes identificó afinidad numérica con ${topNames}, entre otras. Las recomendaciones comparten la dirección de tus ejes con mayor precisión.`;
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

  const top = ranked.slice(0, count);
  if (top.length === 0) {
    return NextResponse.json({ error: "No hay fragancias que coincidan." }, { status: 404 });
  }

  const recommendations = top.map((c) => {
    const rowWithScore: Row = { ...c.f, score: c.score } as Row;
    return {
      ...c.f,
      reason: buildReason(rowWithScore, referenceName),
      score: c.score
    };
  });

  const reflection = buildReflection(effectiveVector, setId, gender, top, referenceName);
  const elapsed = Date.now() - startedAt;

  return NextResponse.json({
    recommendations,
    reflection,
    elapsed_ms: elapsed,
    reference: referenceName
  });
}

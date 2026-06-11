import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { affinity, FAMILY_AXES, MOOD_AXES } from "@/lib/vectors";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
};

const FAMILY_COLUMNS = ["vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand"];
const MOOD_COLUMNS = ["vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"];

const SELECT_LIST = [
  "id",
  "slug",
  "brand",
  "name",
  "full_name",
  "family",
  "mood",
  "gender",
  "image_url"
].join(", ");

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const set = HEXAGON_SETS[body.set];
  if (!set) return NextResponse.json({ error: "Set no válido" }, { status: 400 });
  const gender: Gender = body.gender === "hombre" || body.gender === "mujer" ? body.gender : "unisex";

  const config = await getAiConfig();
  if (!config.api_key) {
    return NextResponse.json(
      { error: "El decodificador aún no ha sido configurado por el administrador." },
      { status: 503 }
    );
  }

  const pool = getPool();
  const cols = body.set === "familias" ? FAMILY_COLUMNS : MOOD_COLUMNS;
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  // gender = 'unisex' ⇒ sin filtro; si no, parámetro $1
  const genderClause = gender === "unisex" ? "" : "AND (gender = $1 OR gender = 'unisex')";
  const result = await pool.query(
    `SELECT ${SELECT_LIST}, ${colsSql} FROM fragrance WHERE active = TRUE ${genderClause}`,
    gender === "unisex" ? [] : [gender]
  );
  // 2) Hidratar columnas vec_* en una sola estructura por fila
  type Row = {
    id: number;
    slug: string;
    brand: string;
    name: string;
    full_name: string;
    family: string | null;
    mood: string | null;
    gender: Gender;
    image_url: string | null;
    [k: string]: unknown;
  };
  const rows = result.rows as Row[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "El catálogo está vacío." }, { status: 503 });
  }

  // 3) Ranking numérico
  const axisIds = body.set === "familias" ? FAMILY_AXES.map((a) => a.id) : MOOD_AXES.map((a) => a.id);
  const ranked = rows
    .map((f) => {
      const fragVec: Record<string, number> = {};
      for (const col of cols) {
        const id = col.replace("vec_", "");
        fragVec[id] = Number(f[col] ?? 50);
      }
      const score = affinity(body.vector, fragVec);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);

  // 4) Top 6 (antes 12) para que el LLM elija 5 con justificación breve
  const top = ranked.slice(0, 6);
  if (top.length === 0) {
    return NextResponse.json({ error: "No hay fragancias que coincidan." }, { status: 404 });
  }

  // 5) Prompt compacto, baja temperatura
  const compactList = top
    .map(
      (c, i) =>
        `${i + 1}. ${c.f.brand} — ${c.f.name} | slug=${c.f.slug} | afinidad=${c.score}%${c.f.family ? ` | ${c.f.family}` : ""}`
    )
    .join("\n");

  const compactSystem =
    "Eres el curador de Polianthes. Recibes una lista de 6 fragancias rankeadas por afinidad al cliente. " +
    "Devuelve SOLO JSON estricto: {\"recommendations\":[{\"slug\":\"...\",\"reason\":\"frase ≤ 14 palabras en español, evocadora\"}]} " +
    "con exactamente 5 elementos en el mismo orden de la lista, sin texto fuera del JSON.";

  const userPrompt = `Vector (${body.set}): ${set.axes
    .map((a) => `${a.label}=${body.vector[a.id] ?? 0}`)
    .join(", ")}\nGénero: ${gender}\n\nCandidatos:\n${compactList}`;

  try {
    const completion = await chatCompletion(
      { ...config, temperature: 0.3 },
      [
        { role: "system", content: compactSystem },
        { role: "user", content: userPrompt }
      ]
    );
    const text = completion.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const safe = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(safe) as { recommendations?: { slug: string; reason: string }[] };

    const picked = (parsed.recommendations ?? []).slice(0, 5);
    const recommendations = picked
      .map((p) => {
        const found = top.find((c) => c.f.slug === p.slug);
        if (!found) return null;
        return { ...found.f, reason: p.reason, score: found.score };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Rellenar con ranking numérico si el LLM omitió
    if (recommendations.length < 5) {
      for (const cand of top) {
        if (recommendations.length >= 5) break;
        if (recommendations.find((r) => r.slug === cand.f.slug)) continue;
        recommendations.push({
          ...cand.f,
          reason: "Coincidencia numérica alta con tu vector.",
          score: cand.score
        });
      }
    }

    const elapsed = Date.now() - startedAt;
    return NextResponse.json({ recommendations: recommendations.slice(0, 5), elapsed_ms: elapsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion, extractFirstJson } from "@/lib/llm";
import { affinity, FAMILY_AXES, MOOD_AXES } from "@/lib/vectors";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
  mode?: "fast" | "rich";
};

const FAMILY_COLUMNS = ["vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand"];
const MOOD_COLUMNS = ["vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"];

const SELECT_LIST = ["id", "slug", "brand", "name", "full_name", "family", "mood", "gender", "image_url"].join(", ");

const FAST_REASONS = [
  "Afin a tu vector numérico.",
  "Tu afinidad es alta en este perfil.",
  "Corresponde bien a la dirección que marcas.",
  "Coincidencia sólida con tus ejes.",
  "Tu firma olfativa resuena aquí."
];

const FALLBACK_REFLECTION =
  "Tu mapa olfativo se inclina con claridad hacia una familia dominante. La selección reune firmas que honran esa dirección. Inspiración: cada fragancia es una versión inspirada en las composiciones originales; sus creadores reinterpretan la fórmula sin replicarla.";

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
  const mode: "fast" | "rich" = body.mode === "rich" ? "rich" : "fast";

  const pool = getPool();
  const cols = body.set === "familias" ? FAMILY_COLUMNS : MOOD_COLUMNS;
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  const genderClause = gender === "unisex" ? "" : "AND (gender = $1 OR gender = 'unisex')";
  const result = await pool.query(
    `SELECT ${SELECT_LIST}, ${colsSql} FROM fragrance WHERE active = TRUE ${genderClause}`,
    gender === "unisex" ? [] : [gender]
  );
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

  const top = ranked.slice(0, 6);
  if (top.length === 0) {
    return NextResponse.json({ error: "No hay fragancias que coincidan." }, { status: 404 });
  }

  // MODO FAST: ranking numérico puro
  if (mode === "fast") {
    const recommendations = top.slice(0, 5).map((c, i) => ({
      ...c.f,
      reason: FAST_REASONS[i % FAST_REASONS.length],
      score: c.score
    }));
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({ recommendations, elapsed_ms: elapsed, mode: "fast" });
  }

  // MODO RICH: LLM con razones + reflexión
  const compactList = top
    .map((c, i) => `${i + 1}. ${c.f.brand} ${c.f.name} | ${c.f.slug} | ${c.score}%`)
    .join("\n");

  // Vector del cliente formateado para que la IA lo vea
  const vectorText = set.axes
    .map((a) => `${a.label}=${body.vector[a.id] ?? 0}`)
    .join(", ");

  const richSystem =
    "Eres el curador humano de Polianthes. Hablas en español, con voz segura, cálida y editorial. " +
    "Tu única salida es un objeto JSON estricto (sin markdown, sin <think>, sin texto extra). " +
    "Estructura: " +
    '{"r":[{"s":"slug","w":"frase ≤ 14 palabras, evocadora y humana"}],' +
    '"f":"reflexión narrativa de 2-3 frases (≤ 80 palabras) que sintetiza la configuración del cliente y humaniza las fragancias. La palabra Inspiración debe aparecer literalmente en la reflexión."}';

  const richUser = `Set: ${body.set}\nVector del cliente: ${vectorText}\nGénero: ${gender}\nCandidatos:\n${compactList}`;

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
      .slice(0, 5);

    const recommendations = picked
      .map((p) => {
        const found = top.find((c) => c.f.slug === p.slug);
        if (!found) return null;
        return { ...found.f, reason: p.reason, score: found.score };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (recommendations.length < 5) {
      for (const cand of top) {
        if (recommendations.length >= 5) break;
        if (recommendations.find((r) => r.slug === cand.f.slug)) continue;
        recommendations.push({
          ...cand.f,
          reason: FAST_REASONS[recommendations.length % FAST_REASONS.length],
          score: cand.score
        });
      }
    }

    // Reflejar "Inspiración" si la IA lo olvidó
    let reflection = (parsed.f ?? "").trim();
    if (reflection && !/inspiraci[oó]n/i.test(reflection)) {
      reflection = `${reflection} Inspiración: cada fragancia es una versión inspirada en las composiciones originales.`;
    } else if (!reflection) {
      reflection = FALLBACK_REFLECTION;
    }

    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      recommendations: recommendations.slice(0, 5),
      reflection,
      elapsed_ms: elapsed,
      mode: "rich"
    });
  } catch (err) {
    const recommendations = top.slice(0, 5).map((c, i) => ({
      ...c.f,
      reason: FAST_REASONS[i % FAST_REASONS.length],
      score: c.score
    }));
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      recommendations,
      reflection: FALLBACK_REFLECTION,
      elapsed_ms: elapsed,
      mode: "fallback",
      warning: err instanceof Error ? err.message : ""
    });
  }
}

async function configReadyOrThrow() {
  const c = await getAiConfig();
  if (!c.api_key) throw new Error("API key no configurada");
  return c;
}

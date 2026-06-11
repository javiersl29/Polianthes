import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { affinity, FAMILY_AXES, MOOD_AXES } from "@/lib/vectors";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
};

const FAMILY_COLUMNS = ["vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand"];
const MOOD_COLUMNS = ["vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"];

export async function POST(req: NextRequest) {
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
  const select = ["id", "slug", "brand", "name", "full_name", "family", "mood", "gender", "image_url", ...cols].join(", ");
  const result = await pool.query(
    `SELECT ${select} FROM fragrance WHERE active = TRUE`
  );
  const catalog = result.rows as Array<Record<string, unknown> & {
    id: number;
    slug: string;
    brand: string;
    name: string;
    full_name: string;
    family: string | null;
    mood: string | null;
    gender: Gender;
    image_url: string | null;
  }>;

  if (catalog.length === 0) {
    return NextResponse.json({ error: "El catálogo está vacío." }, { status: 503 });
  }

  // 1) Filtro de género
  const genderFiltered = gender === "unisex" ? catalog : catalog.filter((f) => f.gender === gender || f.gender === "unisex");

  // 2) Ranking numérico por afinidad coseno
  const ranked = genderFiltered
    .map((f) => {
      const fragVec: Record<string, number> = {};
      const axisIds = body.set === "familias" ? FAMILY_AXES.map((a) => a.id) : MOOD_AXES.map((a) => a.id);
      for (let i = 0; i < cols.length; i += 1) {
        fragVec[axisIds[i]] = Number(f[cols[i]] ?? 50);
      }
      const score = affinity(body.vector, fragVec);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);

  // 3) Tomar top 12 candidatos para que el LLM elija los 5 mejores
  const top = ranked.slice(0, 12);

  if (top.length === 0) {
    return NextResponse.json({ error: "No hay fragancias que coincidan con el género seleccionado." }, { status: 404 });
  }

  const vectorText = set.axes
    .map((a) => `- ${a.label} (${a.hint}): ${body.vector[a.id] ?? 50}/100`)
    .join("\n");
  const catalogText = top
    .map(
      (c) =>
        `• ${c.f.brand} — ${c.f.name} (slug: ${c.f.slug}, afinidad numérica: ${c.score}%)${c.f.family ? ` [familia: ${c.f.family}]` : ""}${c.f.mood ? ` [mood: ${c.f.mood}]` : ""} [género: ${c.f.gender}]`
    )
    .join("\n");

  const userPrompt = `Preferencia de género del cliente: ${gender}.${gender === "unisex" ? " (Considera tanto fragancias de hombre como de mujer; las unisex suelen ser la opción más flexible.)" : " Prioriza fragancias etiquetadas con este género; las unisex también son bienvenidas."}\n\nYa he pre-seleccionado las 12 fragancias con mayor afinidad numérica al vector del cliente (de mayor a menor):\n${catalogText}\n\nVector de afinidad del cliente (${set.id}):\n${vectorText}\n\nDe esa preselección, devuelve exactamente 5 fragancias que mejor encarnen el vector del cliente, reordenadas por relevancia. Para cada una, justifica en una frase breve, máximo 18 palabras, evocadora y segura.`;

  const messages = [
    { role: "system" as const, content: config.system_prompt ?? "" },
    { role: "user" as const, content: userPrompt }
  ];

  try {
    const completion = await chatCompletion(config, messages);
    const text = completion.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const safe = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(safe) as { recommendations?: { slug: string; reason: string }[] };

    // Si el LLM devuelve menos de 5, completar con el ranking numérico
    const picked = (parsed.recommendations ?? []).slice(0, 5);
    const recommendations = picked
      .map((p) => {
        const found = top.find((c) => c.f.slug === p.slug);
        if (!found) return null;
        return { ...found.f, reason: p.reason, score: found.score };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Rellenar si faltan
    if (recommendations.length < 5) {
      for (const cand of top) {
        if (recommendations.length >= 5) break;
        if (recommendations.find((r) => r.slug === cand.f.slug)) continue;
        recommendations.push({ ...cand.f, reason: "Coincidencia numérica alta con tu vector.", score: cand.score });
      }
    }

    return NextResponse.json({ recommendations: recommendations.slice(0, 5), set: body.set });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

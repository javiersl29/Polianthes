import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getFragranceBySlug, listFragrances } from "@/lib/fragrances";
import { chatCompletion } from "@/lib/llm";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres el perfumista documentalista de Polianthes. Recibes el nombre de una fragancia y debes devolver SOLO un JSON estricto con: {"description":"...","family":"una de: Floral|Oriental|Amaderado|Chipre|Cítrico|Gourmand","mood":"una palabra evocadora en español","top_notes":["..."],"heart_notes":["..."],"base_notes":["..."]}. Sin texto fuera del JSON. Notas en español, máximo 5 por capa.`;

export async function POST(req: NextRequest) {
  const { slug } = (await req.json()) as { slug?: string };
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  const detail = await getFragranceBySlug(slug);
  if (!detail) return NextResponse.json({ error: "no encontrada" }, { status: 404 });

  const config = await getAiConfig();
  if (!config.api_key) {
    return NextResponse.json({ error: "API key no configurada" }, { status: 503 });
  }

  const completion = await chatCompletion(
    { ...config, temperature: 0.4 },
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Fragancia: ${detail.brand} — ${detail.name}` }
    ]
  );
  const text = completion.text.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const safe = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  try {
    const data = JSON.parse(safe) as {
      description?: string;
      family?: string;
      mood?: string;
      top_notes?: string[];
      heart_notes?: string[];
      base_notes?: string[];
    };
    const { getPool } = await import("@/lib/db");
    const pool = getPool();
    await pool.query(
      `UPDATE fragrance SET
        description = COALESCE($1, description),
        family = COALESCE($2, family),
        mood = COALESCE($3, mood),
        top_notes = COALESCE($4::text[], top_notes),
        heart_notes = COALESCE($5::text[], heart_notes),
        base_notes = COALESCE($6::text[], base_notes),
        enriched_at = NOW()
       WHERE id = $7`,
      [
        data.description ?? null,
        data.family ?? null,
        data.mood ?? null,
        data.top_notes ?? null,
        data.heart_notes ?? null,
        data.base_notes ?? null,
        detail.id
      ]
    );
    return NextResponse.json({ ok: true, fragrance: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "parse error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const items = await listFragrances();
  return NextResponse.json({ count: items.length, items: items.slice(0, 10) });
}

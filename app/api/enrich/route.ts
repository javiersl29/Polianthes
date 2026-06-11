import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { getFragranceBySlug } from "@/lib/fragrances";
import { enrichFragrance } from "@/lib/enrich";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { slug } = (await req.json()) as { slug?: string };
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  const detail = await getFragranceBySlug(slug);
  if (!detail) return NextResponse.json({ error: "no encontrada" }, { status: 404 });

  const config = await getAiConfig();
  if (!config.api_key) {
    return NextResponse.json({ error: "API key no configurada" }, { status: 503 });
  }

  const result = await enrichFragrance(config, {
    brand: detail.brand,
    name: detail.name,
    full_name: detail.full_name
  });

  // eslint-disable-next-line no-console
  console.log(
    `[enrich] ${detail.full_name} → family_axes=${JSON.stringify(result.family_axes)} mood_axes=${JSON.stringify(result.mood_axes)} fallback=${result.used_fallback} search=${result.provider} hits=${result.search_hits}`
  );

  const pool = getPool();
  await pool.query(
    `UPDATE fragrance SET
      description = COALESCE($1, description),
      family = COALESCE($2, family),
      mood = COALESCE($3, mood),
      gender = COALESCE($4, gender),
      top_notes = COALESCE($5::text[], top_notes),
      heart_notes = COALESCE($6::text[], heart_notes),
      base_notes = COALESCE($7::text[], base_notes),
      vec_floral = $8, vec_oriental = $9, vec_amaderado = $10,
      vec_chipre = $11, vec_citrico = $12, vec_gourmand = $13,
      vec_frescura = $14, vec_misterio = $15, vec_romantico = $16,
      vec_energia = $17, vec_sofisticado = $18, vec_nostalgico = $19,
      vector_justification = $20::jsonb,
      enriched_at = NOW()
     WHERE id = $21`,
    [
      result.description,
      result.family,
      result.mood,
      result.gender,
      result.top_notes.length > 0 ? result.top_notes : null,
      result.heart_notes.length > 0 ? result.heart_notes : null,
      result.base_notes.length > 0 ? result.base_notes : null,
      result.family_axes.floral,
      result.family_axes.oriental,
      result.family_axes.amaderado,
      result.family_axes.chipre,
      result.family_axes.citrico,
      result.family_axes.gourmand,
      result.mood_axes.frescura,
      result.mood_axes.misterio,
      result.mood_axes.romantico,
      result.mood_axes.energia,
      result.mood_axes.sofisticado,
      result.mood_axes.nostalgico,
      JSON.stringify(result.vector_justification),
      detail.id
    ]
  );

  return NextResponse.json({
    ok: true,
    fragrance: {
      description: result.description,
      family: result.family,
      mood: result.mood,
      gender: result.gender,
      top_notes: result.top_notes,
      heart_notes: result.heart_notes,
      base_notes: result.base_notes,
      family_axes: result.family_axes,
      mood_axes: result.mood_axes,
      used_fallback: result.used_fallback,
      search_provider: result.provider
    }
  });
}

export async function GET() {
  const { listFragrances } = await import("@/lib/fragrances");
  const items = await listFragrances();
  return NextResponse.json({ count: items.length, items: items.slice(0, 10) });
}

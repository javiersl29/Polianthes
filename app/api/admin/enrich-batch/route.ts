import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { enrichFragrance } from "@/lib/enrich";

export const dynamic = "force-dynamic";

type Body = { mode?: "pending" | "all"; limit?: number };

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const mode = body.mode ?? "pending";
  const limit = Math.min(50, Math.max(1, body.limit ?? 20));

  const config = await getAiConfig();
  if (!config.api_key) return NextResponse.json({ error: "API key no configurada" }, { status: 503 });

  const pool = getPool();
  const where = mode === "all" ? "" : "WHERE enriched_at IS NULL";
  const result = await pool.query<{ id: number; brand: string; name: string; full_name: string }>(
    `SELECT id, brand, name, full_name FROM fragrance ${where} ORDER BY id LIMIT $1`,
    [limit]
  );
  const items = result.rows;
  if (items.length === 0) return NextResponse.json({ processed: 0, updated: 0, failed: 0 });

  let updated = 0;
  let failed = 0;
  const errors: { id: number; full_name: string; error: string }[] = [];

  for (const item of items) {
    try {
      const r = await enrichFragrance(config, {
        brand: item.brand,
        name: item.name,
        full_name: item.full_name
      });
      // eslint-disable-next-line no-console
      console.log(
        `[enrich-batch] ${item.full_name} → family_axes=${JSON.stringify(r.family_axes)} mood_axes=${JSON.stringify(r.mood_axes)} fallback=${r.used_fallback} search=${r.provider}`
      );
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
          r.description,
          r.family,
          r.mood,
          r.gender,
          r.top_notes.length > 0 ? r.top_notes : null,
          r.heart_notes.length > 0 ? r.heart_notes : null,
          r.base_notes.length > 0 ? r.base_notes : null,
          r.family_axes.floral,
          r.family_axes.oriental,
          r.family_axes.amaderado,
          r.family_axes.chipre,
          r.family_axes.citrico,
          r.family_axes.gourmand,
          r.mood_axes.frescura,
          r.mood_axes.misterio,
          r.mood_axes.romantico,
          r.mood_axes.energia,
          r.mood_axes.sofisticado,
          r.mood_axes.nostalgico,
          JSON.stringify(r.vector_justification),
          item.id
        ]
      );
      updated += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "error";
      errors.push({ id: item.id, full_name: item.full_name, error: msg });
      // eslint-disable-next-line no-console
      console.error(`[enrich-batch] error en ${item.full_name}:`, msg);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ processed: items.length, updated, failed, errors: errors.slice(0, 5) });
}

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const pool = getPool();
  const r = await pool.query<{ total: string; enriched: string }>(
    `SELECT COUNT(*)::text AS total, COUNT(enriched_at)::text AS enriched FROM fragrance`
  );
  return NextResponse.json({ total: Number(r.rows[0].total), enriched: Number(r.rows[0].enriched) });
}

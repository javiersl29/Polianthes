import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { clamp01to100 } from "@/lib/vectors";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres el perfumista documentalista de Polianthes. Recibes el nombre de una fragancia y debes devolver SOLO un JSON estricto con la siguiente forma:

{
  "description": "…",
  "family": "una de: Floral|Oriental|Amaderado|Chipre|Cítrico|Gourmand",
  "mood": "una palabra evocadora en español",
  "gender": "hombre|mujer|unisex",
  "top_notes": ["…"],
  "heart_notes": ["…"],
  "base_notes": ["…"],
  "family_axes": {
    "floral": 0-100, "oriental": 0-100, "amaderado": 0-100,
    "chipre": 0-100, "citrico": 0-100, "gourmand": 0-100
  },
  "mood_axes": {
    "frescura": 0-100, "misterio": 0-100, "romantico": 0-100,
    "energia": 0-100, "sofisticado": 0-100, "nostalgico": 0-100
  }
}

Sin texto fuera del JSON. Notas en español, máximo 5 por capa. Descripción en español, máximo 2 frases. Para 'gender' usa la convención de la maison: 'pour homme' o nombres típicamente masculinos → hombre; fragancias con '(Mujer)' o nombres femeninos → mujer; el resto → unisex.

Los vectores (family_axes, mood_axes) puntúan la composición aromática real de la fragancia de 0 (ausente) a 100 (dominante). Sé leal a la realidad: si es un cítrico, citrico≈85 y el resto 10-30; si tiene sándalo y oud, amaderado≈70 y oriental≈50. Cada fragancia suele tener 1-2 ejes altos (60-90), 1-2 medios (30-60) y el resto bajos (5-25).`;

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
      const completion = await chatCompletion(
        { ...config, temperature: 0.4 },
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Fragancia: ${item.brand} — ${item.name}` }
        ]
      );
      const text = completion.text.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const safe = start >= 0 && end > start ? text.slice(start, end + 1) : text;
      const data = JSON.parse(safe) as {
        description?: string;
        family?: string;
        mood?: string;
        gender?: "hombre" | "mujer" | "unisex";
        top_notes?: string[];
        heart_notes?: string[];
        base_notes?: string[];
        family_axes?: Record<string, unknown>;
        mood_axes?: Record<string, unknown>;
      };
      const gender = data.gender === "hombre" || data.gender === "mujer" ? data.gender : "unisex";
      const fa = data.family_axes ?? {};
      const ma = data.mood_axes ?? {};
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
          data.description ?? null,
          data.family ?? null,
          data.mood ?? null,
          gender,
          data.top_notes ?? null,
          data.heart_notes ?? null,
          data.base_notes ?? null,
          clamp01to100(fa.floral),
          clamp01to100(fa.oriental),
          clamp01to100(fa.amaderado),
          clamp01to100(fa.chipre),
          clamp01to100(fa.citrico),
          clamp01to100(fa.gourmand),
          clamp01to100(ma.frescura),
          clamp01to100(ma.misterio),
          clamp01to100(ma.romantico),
          clamp01to100(ma.energia),
          clamp01to100(ma.sofisticado),
          clamp01to100(ma.nostalgico),
          JSON.stringify({ family_axes: fa, mood_axes: ma }),
          item.id
        ]
      );
      updated += 1;
    } catch (err) {
      failed += 1;
      errors.push({ id: item.id, full_name: item.full_name, error: err instanceof Error ? err.message : "error" });
    }
    // Pausa para no saturar la API
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

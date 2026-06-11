import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-config";
import { getPool } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres el perfumista documentalista de Polianthes. Recibes el nombre de una fragancia y debes devolver SOLO un JSON estricto con: {"description":"...","family":"una de: Floral|Oriental|Amaderado|Chipre|Cítrico|Gourmand","mood":"una palabra evocadora en español","gender":"hombre|mujer|unisex","top_notes":["..."],"heart_notes":["..."],"base_notes":["..."]}. Sin texto fuera del JSON. Notas en español, máximo 5 por capa. Descripción en español, máximo 2 frases. Para 'gender' usa la convención de la maison: 'pour homme' o nombres típicamente masculinos → hombre; fragancias con '(Mujer)' o nombres femeninos → mujer; el resto → unisex.`;

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
      };
      const gender = data.gender === "hombre" || data.gender === "mujer" ? data.gender : "unisex";
      await pool.query(
        `UPDATE fragrance SET
          description = COALESCE($1, description),
          family = COALESCE($2, family),
          mood = COALESCE($3, mood),
          gender = COALESCE($4, gender),
          top_notes = COALESCE($5::text[], top_notes),
          heart_notes = COALESCE($6::text[], heart_notes),
          base_notes = COALESCE($7::text[], base_notes),
          enriched_at = NOW()
         WHERE id = $8`,
        [
          data.description ?? null,
          data.family ?? null,
          data.mood ?? null,
          gender,
          data.top_notes ?? null,
          data.heart_notes ?? null,
          data.base_notes ?? null,
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

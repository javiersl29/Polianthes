import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { affinity } from "@/lib/vectors";

export const dynamic = "force-dynamic";

const FAMILY_COLUMNS = [
  "vec_floral",
  "vec_oriental",
  "vec_amaderado",
  "vec_chipre",
  "vec_citrico",
  "vec_gourmand"
] as const;

const MOOD_COLUMNS = [
  "vec_frescura",
  "vec_misterio",
  "vec_romantico",
  "vec_energia",
  "vec_sofisticado",
  "vec_nostalgico"
] as const;

const ALL_VEC_COLUMNS = [...FAMILY_COLUMNS, ...MOOD_COLUMNS];

type Row = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: "hombre" | "mujer" | "unisex";
  image_url: string | null;
  image_version: number | null;
  display_code: string | null;
  artistic_name: string | null;
  min_price_cents: number | null;
  [k: string]: unknown;
};

/**
 * GET /api/fragrances/[slug]/similar?limit=5
 *
 * Devuelve las N fragancias (default 5) con mayor afinidad olfativa
 * a la fragancia de referencia [slug], usando cosine similarity sobre
 * el vector completo de 12 dimensiones (6 familias + 6 mood). Se
 * excluye la fragancia de referencia y solo se consideran fragancias
 * activas. La respuesta incluye `score` (0-100) y la `image_url` ya
 * resuelta (incluye `image_version` para cache-bust del `<img>` del
 * catálogo público).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { slug: string } }
) {
  const slug = ctx.params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "5");
  const limit = Math.max(1, Math.min(20, Number.isFinite(limitParam) ? limitParam : 5));

  const pool = getPool();

  // 1) Cargar fragancia de referencia
  const refRes = await pool.query<Row>(
    `SELECT id, slug, brand, name, full_name, family, mood, gender,
            CASE
              WHEN image_data IS NOT NULL THEN '/api/image/' || slug
              WHEN image_url IS NULL OR image_url LIKE '/fragancias/%' THEN NULL
              ELSE image_url
            END AS image_url,
            LENGTH(image_data) AS image_version,
            display_code, artistic_name,
            ${ALL_VEC_COLUMNS.map((c) => `"${c}"`).join(", ")}
     FROM fragrance WHERE slug = $1 AND active = TRUE`,
    [slug]
  );
  if (refRes.rows.length === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  const ref = refRes.rows[0];

  // 2) Cargar candidatas (excluyendo la referencia)
  const candRes = await pool.query<Row>(
    `SELECT id, slug, brand, name, full_name, family, mood, gender,
            CASE
              WHEN image_data IS NOT NULL THEN '/api/image/' || slug
              WHEN image_url IS NULL OR image_url LIKE '/fragancias/%' THEN NULL
              ELSE image_url
            END AS image_url,
            LENGTH(image_data) AS image_version,
            display_code, artistic_name,
            (
              SELECT MIN(p.price_cents) FROM presentation p
              WHERE p.fragrance_id = fragrance.id AND p.active = TRUE
                AND p.price_cents IS NOT NULL AND p.price_cents > 0
            ) AS min_price_cents,
            ${ALL_VEC_COLUMNS.map((c) => `"${c}"`).join(", ")}
     FROM fragrance WHERE active = TRUE AND slug != $1`,
    [slug]
  );

  // 3) Construir vector de la referencia (12 dimensiones)
  const refVec: Record<string, number> = {};
  for (const col of ALL_VEC_COLUMNS) {
    refVec[col.replace("vec_", "")] = Number(ref[col] ?? 50);
  }

  // 4) Rankear candidatas por cosine similarity
  const ranked = candRes.rows
    .map((f) => {
      const vec: Record<string, number> = {};
      for (const col of ALL_VEC_COLUMNS) {
        vec[col.replace("vec_", "")] = Number(f[col] ?? 50);
      }
      const score = affinity(refVec, vec);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const similar = ranked.map(({ f, score }) => ({
    id: f.id,
    slug: f.slug,
    brand: f.brand,
    name: f.name,
    full_name: f.full_name,
    family: f.family,
    mood: f.mood,
    gender: f.gender,
    image_url: f.image_url,
    image_version: f.image_version,
    display_code: f.display_code,
    artistic_name: f.artistic_name,
    min_price_cents: f.min_price_cents,
    score
  }));

  return NextResponse.json({ similar });
}

import { query } from "./db";

export type Gender = "hombre" | "mujer" | "unisex";

export type FragranceListItem = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  image_url: string | null;
  /**
   * Versión de la imagen (tamaño en bytes de `image_data`). Se usa
   * como query param `?v=<image_version>` en el `<img src>` del
   * catálogo público para forzar al browser a recargar la imagen
   * cuando el admin guarda una nueva. Sin esto, el navegador puede
   * seguir mostrando la versión anterior cacheada en disco.
   */
  image_version: number | null;
  display_code: string | null;
  artistic_name: string | null;
  inspired_by_name: string | null;
  inspired_by_brand: string | null;
  min_price_cents: number | null;
  vec_floral: number;
  vec_oriental: number;
  vec_amaderado: number;
  vec_chipre: number;
  vec_citrico: number;
  vec_gourmand: number;
  vec_frescura: number;
  vec_misterio: number;
  vec_romantico: number;
  vec_energia: number;
  vec_sofisticado: number;
  vec_nostalgico: number;
};

export async function listFragrances(): Promise<FragranceListItem[]> {
  const result = await query<FragranceListItem>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            f.display_code, f.artistic_name, f.inspired_by_name, f.inspired_by_brand,
            f.vec_floral, f.vec_oriental, f.vec_amaderado, f.vec_chipre, f.vec_citrico, f.vec_gourmand,
            f.vec_frescura, f.vec_misterio, f.vec_romantico, f.vec_energia, f.vec_sofisticado, f.vec_nostalgico,
            (
              SELECT MIN(p.price_cents) FROM presentation p
              WHERE p.fragrance_id = f.id AND p.active = TRUE AND p.price_cents IS NOT NULL AND p.price_cents > 0
            ) AS min_price_cents
     FROM fragrance f WHERE f.active = TRUE ORDER BY f.brand, f.name`
  );
  return result.rows;
}

/**
 * Versión ligera para sitemap: solo slug + created_at.
 */
export async function listActiveFragranceSlugs(): Promise<Array<{ slug: string; created_at: Date }>> {
  const r = await query<{ slug: string; created_at: Date }>(
    `SELECT slug, created_at FROM fragrance WHERE active = TRUE ORDER BY created_at DESC`
  );
  return r.rows;
}

export async function searchFragrances(
  text: string,
  note?: string | null,
  gender?: Gender | null,
  limit: number = 60,
  offset: number = 0
): Promise<FragranceListItem[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const safeOffset = Math.max(0, offset);
  const params: unknown[] = [];
  let where = `active = TRUE`;
  if (text && text.trim().length > 0) {
    params.push(`%${text.toLowerCase()}%`);
    where += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(brand) LIKE $${params.length})`;
  }
  if (note && note.trim().length > 0) {
    params.push(`%${note.toLowerCase()}%`);
    where += ` AND (
      LOWER(COALESCE(family, '')) LIKE $${params.length} OR
      EXISTS (SELECT 1 FROM unnest(top_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      EXISTS (SELECT 1 FROM unnest(heart_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      EXISTS (SELECT 1 FROM unnest(base_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      LOWER(COALESCE(mood, '')) LIKE $${params.length}
    )`;
  }
  if (gender) {
    params.push(gender);
    where += ` AND (gender = $${params.length} OR gender = 'unisex')`;
  }
  params.push(safeLimit);
  params.push(safeOffset);
  const result = await query<FragranceListItem>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            f.display_code, f.artistic_name, f.inspired_by_name, f.inspired_by_brand,
            f.vec_floral, f.vec_oriental, f.vec_amaderado, f.vec_chipre, f.vec_citrico, f.vec_gourmand,
            f.vec_frescura, f.vec_misterio, f.vec_romantico, f.vec_energia, f.vec_sofisticado, f.vec_nostalgico,
            (
              SELECT MIN(p.price_cents) FROM presentation p
              WHERE p.fragrance_id = f.id AND p.active = TRUE AND p.price_cents IS NOT NULL AND p.price_cents > 0
            ) AS min_price_cents
     FROM fragrance f WHERE ${where} ORDER BY f.brand, f.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

/**
 * Cuenta el total de fragancias activas que coinciden con los filtros
 * (sin paginación), para que el frontend sepa si hay más que cargar.
 */
export async function countSearchFragrances(
  text: string,
  note?: string | null,
  gender?: Gender | null
): Promise<number> {
  const params: unknown[] = [];
  let where = `active = TRUE`;
  if (text && text.trim().length > 0) {
    params.push(`%${text.toLowerCase()}%`);
    where += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(brand) LIKE $${params.length})`;
  }
  if (note && note.trim().length > 0) {
    params.push(`%${note.toLowerCase()}%`);
    where += ` AND (
      LOWER(COALESCE(family, '')) LIKE $${params.length} OR
      EXISTS (SELECT 1 FROM unnest(top_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      EXISTS (SELECT 1 FROM unnest(heart_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      EXISTS (SELECT 1 FROM unnest(base_notes) n WHERE LOWER(n) LIKE $${params.length}) OR
      LOWER(COALESCE(mood, '')) LIKE $${params.length}
    )`;
  }
  if (gender) {
    params.push(gender);
    where += ` AND (gender = $${params.length} OR gender = 'unisex')`;
  }
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM fragrance f WHERE ${where}`,
    params
  );
  return Number(result.rows[0]?.count ?? 0);
}

export type PresentationDetail = {
  size_ml: number;
  price_cents: number | null;
  compare_at_price_cents: number | null;
  stock: number | null;
  sku: string | null;
};

export type FragranceDetail = Omit<FragranceListItem, "min_price_cents"> & {
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  inspiration_image_url: string | null;
  presentations: PresentationDetail[];
};

export async function getFragranceBySlug(slug: string): Promise<FragranceDetail | null> {
  const result = await query<FragranceDetail>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            f.display_code, f.artistic_name, f.inspired_by_name, f.inspired_by_brand,
            f.description, f.top_notes, f.heart_notes, f.base_notes, f.inspiration_image_url,
            f.vec_floral, f.vec_oriental, f.vec_amaderado, f.vec_chipre, f.vec_citrico, f.vec_gourmand,
            f.vec_frescura, f.vec_misterio, f.vec_romantico, f.vec_energia, f.vec_sofisticado, f.vec_nostalgico,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'size_ml', p.size_ml,
                 'price_cents', p.price_cents,
                 'compare_at_price_cents', p.compare_at_price_cents,
                 'stock', p.stock,
                 'sku', p.sku
               ) ORDER BY p.size_ml)
               FROM presentation p WHERE p.fragrance_id = f.id AND p.active = TRUE),
              '[]'::json
            ) AS presentations
     FROM fragrance f WHERE f.slug = $1 AND f.active = TRUE`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export type AdminPresentation = {
  id: number;
  fragrance_id: number;
  size_ml: number;
  price_cents: number | null;
  compare_at_price_cents: number | null;
  stock: number | null;
  sku: string | null;
  weight_grams: number | null;
  active: boolean;
};

export async function listAdminPresentations(): Promise<Array<{
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  active: boolean;
  presentations: AdminPresentation[];
}>> {
  const result = await query<{
    id: number;
    slug: string;
    brand: string;
    name: string;
    full_name: string;
    active: boolean;
    presentations: AdminPresentation[];
  }>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.active,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', p.id,
                 'fragrance_id', p.fragrance_id,
                 'size_ml', p.size_ml,
                 'price_cents', p.price_cents,
                 'compare_at_price_cents', p.compare_at_price_cents,
                 'stock', p.stock,
                 'sku', p.sku,
                 'weight_grams', p.weight_grams,
                 'active', p.active
               ) ORDER BY p.size_ml)
               FROM presentation p WHERE p.fragrance_id = f.id),
              '[]'::json
             ) AS presentations
     FROM fragrance f WHERE f.active = TRUE ORDER BY f.brand, f.name`
  );
  return result.rows;
}

const VEC_COLUMNS_ALL = [
  "vec_floral",
  "vec_oriental",
  "vec_amaderado",
  "vec_chipre",
  "vec_citrico",
  "vec_gourmand",
  "vec_frescura",
  "vec_misterio",
  "vec_romantico",
  "vec_energia",
  "vec_sofisticado",
  "vec_nostalgico"
] as const;

export type SimilarFragrance = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  image_url: string | null;
  image_version: number | null;
  display_code: string | null;
  artistic_name: string | null;
  min_price_cents: number | null;
  score: number;
};

/**
 * Devuelve las N fragancias con mayor afinidad olfativa (cosine
 * similarity sobre 12 dimensiones) a la fragancia con `slug`.
 * Se excluye la referencia y solo se incluyen fragancias activas.
 */
export async function getSimilarFragrances(
  slug: string,
  limit: number = 5
): Promise<SimilarFragrance[]> {
  // 1) Vector de la referencia
  const refRes = await query<Record<string, unknown>>(
    `SELECT ${VEC_COLUMNS_ALL.map((c) => `"${c}"`).join(", ")}
     FROM fragrance WHERE slug = $1 AND active = TRUE`,
    [slug]
  );
  if (refRes.rows.length === 0) return [];
  const ref = refRes.rows[0];
  const refVec: Record<string, number> = {};
  for (const col of VEC_COLUMNS_ALL) {
    refVec[col.replace("vec_", "")] = Number(ref[col] ?? 50);
  }

  // 2) Candidatas (excluye la referencia). Se seleccionan los
  //    campos necesarios para la card del catálogo público.
  const candRes = await query<Record<string, unknown>>(
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
            ${VEC_COLUMNS_ALL.map((c) => `"${c}"`).join(", ")}
     FROM fragrance WHERE active = TRUE AND slug != $1`,
    [slug]
  );

  // 3) Rankear por cosine similarity (import lazy para no acoplar
  //    este módulo a la lógica de vectores en el server bundle).
  const { affinity } = await import("./vectors");
  const ranked = candRes.rows
    .map((row) => {
      const vec: Record<string, number> = {};
      for (const col of VEC_COLUMNS_ALL) {
        vec[col.replace("vec_", "")] = Number(row[col] ?? 50);
      }
      const score = affinity(refVec, vec);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ row, score }) => ({
    id: Number(row.id),
    slug: String(row.slug),
    brand: String(row.brand),
    name: String(row.name),
    full_name: String(row.full_name),
    family: (row.family as string | null) ?? null,
    mood: (row.mood as string | null) ?? null,
    gender: row.gender as Gender,
    image_url: (row.image_url as string | null) ?? null,
    image_version: row.image_version == null ? null : Number(row.image_version),
    display_code: (row.display_code as string | null) ?? null,
    artistic_name: (row.artistic_name as string | null) ?? null,
    min_price_cents:
      row.min_price_cents == null ? null : Number(row.min_price_cents),
    score
  }));
}

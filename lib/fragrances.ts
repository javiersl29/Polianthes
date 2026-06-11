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
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender, f.image_url,
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

export async function searchFragrances(
  text: string,
  note?: string | null,
  gender?: Gender | null
): Promise<FragranceListItem[]> {
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
  const result = await query<FragranceListItem>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender, f.image_url,
            f.display_code, f.artistic_name, f.inspired_by_name, f.inspired_by_brand,
            f.vec_floral, f.vec_oriental, f.vec_amaderado, f.vec_chipre, f.vec_citrico, f.vec_gourmand,
            f.vec_frescura, f.vec_misterio, f.vec_romantico, f.vec_energia, f.vec_sofisticado, f.vec_nostalgico,
            (
              SELECT MIN(p.price_cents) FROM presentation p
              WHERE p.fragrance_id = f.id AND p.active = TRUE AND p.price_cents IS NOT NULL AND p.price_cents > 0
            ) AS min_price_cents
     FROM fragrance f WHERE ${where} ORDER BY f.brand, f.name LIMIT 60`,
    params
  );
  return result.rows;
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
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender, f.image_url,
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

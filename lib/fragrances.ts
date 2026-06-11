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
};

export async function listFragrances(): Promise<FragranceListItem[]> {
  const result = await query<FragranceListItem>(
    `SELECT id, slug, brand, name, full_name, family, mood, gender, image_url
     FROM fragrance WHERE active = TRUE ORDER BY brand, name`
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
    `SELECT id, slug, brand, name, full_name, family, mood, gender, image_url
     FROM fragrance WHERE ${where} ORDER BY brand, name LIMIT 60`,
    params
  );
  return result.rows;
}

export type FragranceDetail = FragranceListItem & {
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  inspiration_image_url: string | null;
  presentations: { size_ml: number; price_cents: number | null }[];
};

export async function getFragranceBySlug(slug: string): Promise<FragranceDetail | null> {
  const result = await query<FragranceDetail>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.mood, f.gender, f.image_url,
            f.description, f.top_notes, f.heart_notes, f.base_notes, f.inspiration_image_url,
            COALESCE(
              (SELECT json_agg(json_build_object('size_ml', p.size_ml, 'price_cents', p.price_cents) ORDER BY p.size_ml)
               FROM presentation p WHERE p.fragrance_id = f.id AND p.active = TRUE),
              '[]'::json
            ) AS presentations
     FROM fragrance f WHERE f.slug = $1 AND f.active = TRUE`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

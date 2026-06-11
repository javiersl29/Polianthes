import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Gender = "hombre" | "mujer" | "unisex";
type FragranceRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  family: string | null;
  mood: string | null;
  gender: Gender;
  description: string | null;
  image_url: string | null;
  inspiration_image_url: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  active: boolean;
  enriched_at: string | null;
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

const VEC_COLUMNS = [
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

const SELECT_LIST = [
  "id",
  "slug",
  "brand",
  "name",
  "full_name",
  "family",
  "mood",
  "gender",
  "description",
  "image_url",
  "inspiration_image_url",
  "top_notes",
  "heart_notes",
  "base_notes",
  "active",
  "enriched_at",
  ...VEC_COLUMNS
].join(", ");

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const result = await query<FragranceRow>(
    `SELECT ${SELECT_LIST} FROM fragrance ORDER BY brand, name`
  );
  return NextResponse.json({ items: result.rows });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json()) as Partial<FragranceRow> & { id: number };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const gender: Gender | null =
    body.gender === "hombre" || body.gender === "mujer" || body.gender === "unisex" ? body.gender : null;

  // COALESCE: si el body trae el valor, se usa; si no, se conserva el actual
  await query(
    `UPDATE fragrance SET
       description = COALESCE($1, description),
       family = COALESCE($2, family),
       mood = COALESCE($3, mood),
       gender = COALESCE($4, gender),
       image_url = COALESCE($5, image_url),
       inspiration_image_url = COALESCE($6, inspiration_image_url),
       top_notes = COALESCE($7::text[], top_notes),
       heart_notes = COALESCE($8::text[], heart_notes),
       base_notes = COALESCE($9::text[], base_notes),
       active = COALESCE($10, active),
       vec_floral = COALESCE($11, vec_floral),
       vec_oriental = COALESCE($12, vec_oriental),
       vec_amaderado = COALESCE($13, vec_amaderado),
       vec_chipre = COALESCE($14, vec_chipre),
       vec_citrico = COALESCE($15, vec_citrico),
       vec_gourmand = COALESCE($16, vec_gourmand),
       vec_frescura = COALESCE($17, vec_frescura),
       vec_misterio = COALESCE($18, vec_misterio),
       vec_romantico = COALESCE($19, vec_romantico),
       vec_energia = COALESCE($20, vec_energia),
       vec_sofisticado = COALESCE($21, vec_sofisticado),
       vec_nostalgico = COALESCE($22, vec_nostalgico)
     WHERE id = $23`,
    [
      body.description ?? null,
      body.family ?? null,
      body.mood ?? null,
      gender,
      body.image_url ?? null,
      body.inspiration_image_url ?? null,
      body.top_notes ?? null,
      body.heart_notes ?? null,
      body.base_notes ?? null,
      body.active ?? null,
      body.vec_floral ?? null,
      body.vec_oriental ?? null,
      body.vec_amaderado ?? null,
      body.vec_chipre ?? null,
      body.vec_citrico ?? null,
      body.vec_gourmand ?? null,
      body.vec_frescura ?? null,
      body.vec_misterio ?? null,
      body.vec_romantico ?? null,
      body.vec_energia ?? null,
      body.vec_sofisticado ?? null,
      body.vec_nostalgico ?? null,
      body.id
    ]
  );
  return NextResponse.json({ ok: true });
}

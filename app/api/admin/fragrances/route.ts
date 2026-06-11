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
};

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const result = await query<FragranceRow>(
    `SELECT id, slug, brand, name, full_name, family, mood, gender, description, image_url,
            inspiration_image_url, top_notes, heart_notes, base_notes, active, enriched_at
     FROM fragrance ORDER BY brand, name`
  );
  return NextResponse.json({ items: result.rows });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json()) as Partial<FragranceRow> & { id: number };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const gender: Gender | null =
    body.gender === "hombre" || body.gender === "mujer" || body.gender === "unisex" ? body.gender : null;
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
       active = COALESCE($10, active)
     WHERE id = $11`,
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
      body.id
    ]
  );
  return NextResponse.json({ ok: true });
}

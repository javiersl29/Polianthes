import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query, getPool } from "@/lib/db";

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
  "display_code",
  "artistic_name",
  "inspired_by_name",
  "inspired_by_brand",
  "(original_image_data IS NOT NULL) AS has_original_reference",
  "original_image_url",
  "original_image_source",
  "original_image_fetched_at",
  "use_brand_bottle_override",
  ...VEC_COLUMNS
].join(", ");

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function splitBrand(fullName: string): { brand: string; name: string } {
  const idx = fullName.indexOf(" - ");
  if (idx === -1) return { brand: "Independiente", name: fullName.trim() };
  return { brand: fullName.slice(0, idx).trim(), name: fullName.slice(idx + 3).trim() };
}

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

type CreateBody = {
  full_name?: string;
  brand?: string;
  name?: string;
  family?: string | null;
  mood?: string | null;
  gender?: Gender;
  active?: boolean;
  create_presentations?: boolean;
};

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  let brand = (body.brand ?? "").trim();
  let name = (body.name ?? "").trim();
  const fullName = (body.full_name ?? "").trim();
  if (!brand && !name && !fullName) {
    return NextResponse.json({ error: "Indica al menos un nombre" }, { status: 400 });
  }
  if (!brand || !name) {
    const split = splitBrand(fullName);
    brand = brand || split.brand;
    name = name || split.name;
  }
  if (!brand || !name) {
    return NextResponse.json({ error: "Faltan marca o nombre" }, { status: 400 });
  }

  const gender: Gender =
    body.gender === "hombre" || body.gender === "mujer" || body.gender === "unisex" ? body.gender : "unisex";
  const active = body.active !== false;
  const createPresentations = body.create_presentations !== false;

  const baseSlug = slugify(`${brand} ${name}`);
  const fullNameDb = `${brand} - ${name}`;

  const pool = getPool();
  const client = await pool.connect();
  let fragranceId = 0;
  let slug = baseSlug;
  try {
    await client.query("BEGIN");
    let attempt = 0;
    while (attempt < 50) {
      const r = await client.query(
        `INSERT INTO fragrance (slug, brand, name, full_name, family, mood, gender, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [slug, brand, name, fullNameDb, body.family ?? null, body.mood ?? null, gender, active]
      );
      if (r.rows.length > 0) {
        fragranceId = r.rows[0].id;
        break;
      }
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }
    if (fragranceId === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No se pudo generar un slug único" }, { status: 500 });
    }
    await client.query(
      `UPDATE fragrance
       SET display_code = 'PLT-' || LPAD(id::text, 3, '0'),
           inspired_by_brand = $1,
           inspired_by_name = $2
       WHERE id = $3`,
      [brand, name, fragranceId]
    );

    if (createPresentations) {
      await client.query(
        `INSERT INTO presentation (fragrance_id, size_ml, price_cents, cost_cents, stock, sku, active)
         SELECT $1, d.size_ml, d.price_cents, d.cost_cents, d.stock,
                d.sku_prefix || '-' || LPAD($1::text, 3, '0') || '-' || d.size_ml,
                TRUE
         FROM pricing_defaults d
         ON CONFLICT (fragrance_id, size_ml) DO NOTHING`,
        [fragranceId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creando fragancia" },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  const created = await query(
    `SELECT ${SELECT_LIST} FROM fragrance WHERE id = $1`,
    [fragranceId]
  );
  return NextResponse.json({ ok: true, fragrance: created.rows[0] });
}

type DeleteBody = {
  id: number;
  hard?: boolean;
};

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as DeleteBody | null;
  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (body.hard) {
    // Hard delete: presentation tiene ON DELETE CASCADE, así que las presentaciones se borran.
    // order_item tiene ON DELETE RESTRICT, así que bloquea si hay historial de venta.
    const refs = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM order_item WHERE fragrance_id = $1`,
      [body.id]
    );
    if (Number(refs.rows[0]?.count ?? 0) > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: esta fragancia tiene pedidos asociados. Desactívala en su lugar." },
        { status: 409 }
      );
    }
    await query(`DELETE FROM presentation WHERE fragrance_id = $1`, [body.id]);
    await query(`DELETE FROM fragrance WHERE id = $1`, [body.id]);
    return NextResponse.json({ ok: true, mode: "hard" });
  }

  // Soft delete: solo desactivar
  const r = await query<{ slug: string }>(
    `UPDATE fragrance SET active = FALSE WHERE id = $1 RETURNING slug`,
    [body.id]
  );
  if (r.rowCount === 0) {
    return NextResponse.json({ error: "Fragrancia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, mode: "soft", slug: r.rows[0]?.slug });
}

export async function PUT(req: NextRequest) {
  // Reactivar una fragancia dada de baja (reactivación)
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: number } | null;
  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  const r = await query<{ slug: string }>(
    `UPDATE fragrance SET active = TRUE WHERE id = $1 RETURNING slug`,
    [body.id]
  );
  if (r.rowCount === 0) {
    return NextResponse.json({ error: "Fragrancia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, slug: r.rows[0]?.slug });
}

import { NextRequest, NextResponse } from "next/server";
import { query, getPool } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { parseMXN } from "@/lib/money";

export const dynamic = "force-dynamic";

type PatchBody = {
  updates: Array<{
    id: number;
    price_cents?: number | null;
    compare_at_price_cents?: number | null;
    stock?: number | null;
    sku?: string | null;
    weight_grams?: number | null;
    active?: boolean;
  }>;
};

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const result = await query(
    `SELECT p.id, p.fragrance_id, p.size_ml, p.price_cents, p.compare_at_price_cents,
            p.stock, p.sku, p.weight_grams, p.active,
            f.slug, f.brand, f.name, f.full_name
     FROM presentation p
     JOIN fragrance f ON f.id = p.fragrance_id
     WHERE f.active = TRUE
     ORDER BY f.brand, f.name, p.size_ml`
  );
  return NextResponse.json({ items: result.rows });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query("BEGIN");
    for (const u of body.updates) {
      if (typeof u.id !== "number") continue;
      const fields: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if ("price_cents" in u) {
        fields.push(`price_cents = $${i++}`);
        params.push(u.price_cents === null ? null : Number(u.price_cents));
      }
      if ("compare_at_price_cents" in u) {
        fields.push(`compare_at_price_cents = $${i++}`);
        params.push(u.compare_at_price_cents === null ? null : Number(u.compare_at_price_cents));
      }
      if ("stock" in u) {
        fields.push(`stock = $${i++}`);
        params.push(u.stock === null ? null : Number(u.stock));
      }
      if ("sku" in u) {
        fields.push(`sku = $${i++}`);
        params.push(u.sku || null);
      }
      if ("weight_grams" in u) {
        fields.push(`weight_grams = $${i++}`);
        params.push(u.weight_grams === null ? null : Number(u.weight_grams));
      }
      if ("active" in u) {
        fields.push(`active = $${i++}`);
        params.push(Boolean(u.active));
      }
      if (fields.length === 0) continue;
      params.push(u.id);
      const r = await client.query(
        `UPDATE presentation SET ${fields.join(", ")} WHERE id = $${i}`,
        params
      );
      updated += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error actualizando" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true, updated });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { fragrance_id?: number; size_ml?: number; price_mxn?: string | number }
    | null;
  if (!body || typeof body.fragrance_id !== "number" || typeof body.size_ml !== "number") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const cents = body.price_mxn === undefined || body.price_mxn === null ? null : parseMXN(body.price_mxn);
  if (body.price_mxn !== undefined && body.price_mxn !== null && cents === null) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }
  await query(
    `INSERT INTO presentation (fragrance_id, size_ml, price_cents)
     VALUES ($1, $2, $3)
     ON CONFLICT (fragrance_id, size_ml)
     DO UPDATE SET price_cents = EXCLUDED.price_cents`,
    [body.fragrance_id, body.size_ml, cents]
  );
  return NextResponse.json({ ok: true });
}

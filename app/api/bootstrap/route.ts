import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getPool } from "@/lib/db";
import { ensureDefaultAdmin } from "@/lib/auth";
import { loadCatalog, splitBrand } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== (process.env.BOOTSTRAP_SECRET ?? "polianthes-bootstrap")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);

  const rows = loadCatalog();
  let inserted = 0;
  for (const row of rows) {
    const { brand, name } = splitBrand(row.fragrance);
    const slug = slugify(row.fragrance);
    const r = await pool.query(
      `INSERT INTO fragrance (slug, brand, name, full_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET brand = EXCLUDED.brand, name = EXCLUDED.name
       RETURNING id, (xmax = 0) AS inserted`,
      [slug, brand, name, row.fragrance]
    );
    if (r.rows[0].inserted) inserted += 1;
    for (const size of row.presentations) {
      const ml = Number(size.replace("ml", ""));
      await pool.query(
        `INSERT INTO presentation (fragrance_id, size_ml) VALUES ($1, $2)
         ON CONFLICT (fragrance_id, size_ml) DO NOTHING`,
        [r.rows[0].id, ml]
      );
    }
  }
  await ensureDefaultAdmin();
  return NextResponse.json({ ok: true, fragrances_inserted: inserted, total: rows.length });
}

export async function GET() {
  return NextResponse.json({
    hint: "POST con header x-bootstrap-secret para aplicar schema, sembrar catálogo y crear admin inicial."
  });
}

import { loadCatalog, splitBrand } from "./catalog";
import { getPool } from "./db";
import fs from "node:fs";
import path from "node:path";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureSchema(): Promise<void> {
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);
}

async function seed(): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const rows = loadCatalog();
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const { brand, name } = splitBrand(row.fragrance);
    const fullName = row.fragrance;
    const slug = slugify(fullName);
    const result = await pool.query(
      `INSERT INTO fragrance (slug, brand, name, full_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET brand = EXCLUDED.brand, name = EXCLUDED.name
       RETURNING id, (xmax = 0) AS inserted`,
      [slug, brand, name, fullName]
    );
    const fragranceId: number = result.rows[0].id;
    const wasInserted: boolean = result.rows[0].inserted;
    if (wasInserted) inserted += 1;
    else updated += 1;

    for (const size of row.presentations) {
      const ml = Number(size.replace("ml", ""));
      await pool.query(
        `INSERT INTO presentation (fragrance_id, size_ml)
         VALUES ($1, $2)
         ON CONFLICT (fragrance_id, size_ml) DO NOTHING`,
        [fragranceId, ml]
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] procesadas: ${rows.length} | nuevas: ${inserted} | actualizadas: ${updated}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[seed] error:", err);
    process.exit(1);
  });

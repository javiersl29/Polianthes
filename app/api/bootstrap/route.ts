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

async function ensureColumn(pool: ReturnType<typeof getPool>, table: string, column: string, definition: string) {
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== (process.env.BOOTSTRAP_SECRET ?? "polianthes-bootstrap")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const sqlAdmin = fs.readFileSync(path.join(process.cwd(), "db", "schema_admin.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);
  // Ejecutar schema_admin.sql statement por statement para que un error
  // en una tabla (p.ej. ya existe) no revierta todo el bloque.
  // Quitamos comentarios SQL (líneas que empiezan con -- o bloques /* */),
  // luego separamos por ; respetando que NO haya ; dentro de strings.
  const sqlNoComments = sqlAdmin
    .replace(/--[^\n]*/g, "")      // quitar comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, ""); // quitar comentarios de bloque
  const adminStatements = sqlNoComments
    .split(/\s*;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of adminStatements) {
    try {
      await pool.query(stmt);
    } catch (e) {
      console.error("bootstrap stmt failed (continuing):", (e as Error).message?.slice(0, 120));
    }
  }

  // Migraciones idempotentes para columnas añadidas en versiones posteriores
  await ensureColumn(pool, "fragrance", "gender", "TEXT NOT NULL DEFAULT 'unisex'");
  await pool.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'fragrance_gender_check'
       ) THEN
         ALTER TABLE fragrance
           ADD CONSTRAINT fragrance_gender_check
           CHECK (gender IN ('hombre', 'mujer', 'unisex'));
       END IF;
     END$$;`
  );
  // Vectores numéricos 0-100 para afinidad con el decodificador
  const vectorCols = [
    "vec_floral", "vec_oriental", "vec_amaderado", "vec_chipre", "vec_citrico", "vec_gourmand",
    "vec_frescura", "vec_misterio", "vec_romantico", "vec_energia", "vec_sofisticado", "vec_nostalgico"
  ];
  for (const col of vectorCols) {
    await ensureColumn(pool, "fragrance", col, "INTEGER NOT NULL DEFAULT 50");
  }
  await ensureColumn(pool, "fragrance", "vector_justification", "JSONB");

  // Migraciones e-commerce (Sprint 1+): columnas extra en `presentation`
  await ensureColumn(pool, "presentation", "stock", "INTEGER");
  await ensureColumn(pool, "presentation", "sku", "TEXT");
  await ensureColumn(pool, "presentation", "compare_at_price_cents", "INTEGER");
  await ensureColumn(pool, "presentation", "weight_grams", "INTEGER");
  await ensureColumn(pool, "presentation", "cost_cents", "INTEGER");

  // Migraciones: identificación de Polianthes en `fragrance`
  await ensureColumn(pool, "fragrance", "display_code", "TEXT");
  await ensureColumn(pool, "fragrance", "inspired_by_name", "TEXT");
  await ensureColumn(pool, "fragrance", "inspired_by_brand", "TEXT");
  await ensureColumn(pool, "fragrance", "artistic_name", "TEXT");

  // Migraciones: imágenes (refs originales, botella de marca, resultado IA en base64)
  await ensureColumn(pool, "fragrance", "image_data", "TEXT");
  await ensureColumn(pool, "fragrance", "original_image_data", "TEXT");
  await ensureColumn(pool, "fragrance", "original_image_source", "TEXT");
  await ensureColumn(pool, "fragrance", "original_image_url", "TEXT");
  await ensureColumn(pool, "fragrance", "original_image_fetched_at", "TIMESTAMPTZ");
  await ensureColumn(pool, "fragrance", "use_brand_bottle_override", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn(pool, "image_api_config", "gemini_api_key", "TEXT");
  await ensureColumn(pool, "image_api_config", "serper_api_key", "TEXT");
  await ensureColumn(pool, "image_api_config", "zai_api_key", "TEXT");

  // Seed de pricing_defaults (idempotente — no sobrescribe si ya existe)
  await pool.query(
    `INSERT INTO pricing_defaults (size_ml, price_cents, cost_cents, stock, sku_prefix, display_order)
     VALUES (10, 10000, 7000, 100, 'PLT', 1),
            (30, 25000, 19000, 100, 'PLT', 2),
            (60, 35000, 28000, 100, 'PLT', 3),
            (100, 45000, 36000, 100, 'PLT', 4)
     ON CONFLICT (size_ml) DO UPDATE SET
       price_cents = EXCLUDED.price_cents,
       cost_cents = EXCLUDED.cost_cents`
  );

  // Backfill A: asegurar 4 presentaciones por fragancia con precios, stock 100 y SKU
  // (DO NOTHING preserva filas existentes con precio custom)
  await pool.query(
    `INSERT INTO presentation (fragrance_id, size_ml, price_cents, cost_cents, stock, sku, active)
     SELECT f.id, d.size_ml, d.price_cents, d.cost_cents, d.stock,
            d.sku_prefix || '-' || LPAD(f.id::text, 3, '0') || '-' || d.size_ml,
            TRUE
     FROM fragrance f
     CROSS JOIN pricing_defaults d
     WHERE f.active = TRUE
     ON CONFLICT (fragrance_id, size_ml) DO NOTHING`
  );

  // Backfill B: display_code y parseo de inspired_by_* desde full_name
  await pool.query(
    `UPDATE fragrance
     SET display_code = 'PLT-' || LPAD(id::text, 3, '0')
     WHERE display_code IS NULL`
  );
  await pool.query(
    `UPDATE fragrance
     SET inspired_by_brand = SPLIT_PART(full_name, ' - ', 1),
         inspired_by_name = SPLIT_PART(full_name, ' - ', 2)
     WHERE (inspired_by_brand IS NULL OR inspired_by_name IS NULL)
       AND full_name LIKE '% - %'`
  );

  // Backfill C: SKU para filas que no lo tienen (no toca las que ya lo tienen)
  await pool.query(
    `UPDATE presentation p
     SET sku = d.sku_prefix || '-' || LPAD(p.fragrance_id::text, 3, '0') || '-' || p.size_ml
     FROM pricing_defaults d
     WHERE p.sku IS NULL AND p.size_ml = d.size_ml`
  );

  // Migración idempotente: columnas de auth en `customer` (password + email verification)
  await ensureColumn(pool, "customer", "password_hash", "TEXT");
  await ensureColumn(pool, "customer", "email_verified", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn(pool, "customer", "verification_token", "TEXT");
  await ensureColumn(pool, "customer", "verification_expires_at", "TIMESTAMPTZ");
  await ensureColumn(pool, "customer", "password_reset_token", "TEXT");
  await ensureColumn(pool, "customer", "password_reset_expires_at", "TIMESTAMPTZ");
  // Índice para búsqueda por token de verificación (solo si la columna existe)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_customer_verification_token
     ON customer(verification_token)
     WHERE verification_token IS NOT NULL`
  ).catch(() => { /* ignore si la columna no existe todavía */ });

  // Seed image_api_config (idempotente, una sola fila)

  // Migración idempotente: tabla shipping_config para override + default
  await pool.query(
    `CREATE TABLE IF NOT EXISTS shipping_config (
       id INTEGER PRIMARY KEY DEFAULT 1,
       default_cost_cents INTEGER NOT NULL DEFAULT 0,
       default_free_from_cents INTEGER,
       default_estimated_days TEXT,
       override_enabled BOOLEAN NOT NULL DEFAULT FALSE,
       override_cost_cents INTEGER,
       override_free_from_cents INTEGER,
       override_estimated_days TEXT,
       override_label TEXT,
       active BOOLEAN NOT NULL DEFAULT TRUE,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT single_row_shipping_config CHECK (id = 1)
     )`
  );
  await pool.query(
    `INSERT INTO shipping_config (id, default_cost_cents, override_enabled, active)
     VALUES (1, 0, FALSE, TRUE)
     ON CONFLICT (id) DO NOTHING`
  );

  // Seed brand_bottle_image (idempotente, una sola fila)
  await pool.query(
    `INSERT INTO brand_bottle_image (id, mime_type) VALUES (1, 'image/jpeg')
     ON CONFLICT (id) DO NOTHING`
  );

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
  await ensureColumn(pool, "admin_user", "totp_secret", "TEXT");
  await ensureColumn(pool, "admin_user", "totp_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureDefaultAdmin();
  return NextResponse.json({ ok: true, fragrances_inserted: inserted, total: rows.length });
}

export async function GET() {
  return NextResponse.json({
    hint: "POST con header x-bootstrap-secret para aplicar schema, sembrar catálogo y crear admin inicial."
  });
}

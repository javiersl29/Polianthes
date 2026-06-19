import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email/peek
 * Endpoint temporal de diagnóstico para ver el estado de las notificaciones
 * y aplicar acciones administrativas. Protegido por x-bootstrap-secret.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret");
  if (secret !== (process.env.BOOTSTRAP_SECRET ?? "polianthes-bootstrap")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const cfg = await query<Record<string, unknown>>(
    `SELECT id, provider, from_email, from_name, resend_api_key IS NOT NULL AS has_resend_key,
            smtp_host, active, admin_email,
            notify_admin_new_order, notify_customer_confirmation, notify_customer_shipped
     FROM email_config WHERE id = 1`
  );
  const adminR = await query<{ id: number; username: string; totp_enabled: boolean; has_secret: boolean }>(
    `SELECT id, username, totp_enabled, totp_secret IS NOT NULL AS has_secret FROM admin_user`
  );
  const orderR = await query<{ id: number; public_id: string; status: string; customer_email: string }>(
    `SELECT id, public_id, status, customer_email FROM "order" WHERE public_id = $1`,
    ["PLT-MQE3XYN7-LG93"]
  );

  const result: Record<string, unknown> = {
    email_config: cfg.rows[0] ?? null,
    admin_users: adminR.rows,
    target_order: orderR.rows[0] ?? null
  };

  if (action === "migrate") {
    const fs = await import("node:fs");
    const sql = fs.readFileSync("db/schema.sql", "utf8");
    await query(sql);
    result.migrated = true;
  }
  if (action === "drop_promotion") {
    await query(`DROP TABLE IF EXISTS promotion CASCADE`);
    result.dropped = "promotion";
  }
  if (action === "recreate_promotion") {
    await query(`DROP TABLE IF EXISTS promotion CASCADE`);
    const sql = `
      CREATE TABLE promotion (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'bundle'
          CHECK (type IN ('3x2','2x1','bundle_qty','second_unit','percent','fixed','bundle','free_shipping','tiered')),
        value INTEGER NOT NULL DEFAULT 0,
        bundle_price_cents INTEGER NOT NULL DEFAULT 0,
        required_size_ml INTEGER NOT NULL DEFAULT 0,
        mix_sizes BOOLEAN NOT NULL DEFAULT FALSE,
        quantity_to_take INTEGER NOT NULL DEFAULT 3,
        quantity_to_pay INTEGER NOT NULL DEFAULT 2,
        image_url TEXT,
        image_prompt TEXT,
        image_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        badge_text TEXT,
        badge_color TEXT NOT NULL DEFAULT 'gold' CHECK (badge_color IN ('gold','rose','sky','emerald','violet')),
        min_items INTEGER NOT NULL DEFAULT 0,
        max_items INTEGER NOT NULL DEFAULT 0,
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_promotion_active ON promotion(active, sort_order) WHERE active = TRUE;
    `;
    await query(sql);
    result.recreated = "promotion";
  }
  if (action === "migrate_promotion_v2") {
    // Drop CHECK constraint y añadir nuevos tipos + columnas nuevas
    await query(`ALTER TABLE promotion DROP CONSTRAINT IF EXISTS promotion_type_check`);
    await query(`ALTER TABLE promotion ADD COLUMN IF NOT EXISTS bundle_price_cents INTEGER NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE promotion ADD COLUMN IF NOT EXISTS mix_sizes BOOLEAN NOT NULL DEFAULT FALSE`);
    await query(`ALTER TABLE promotion ADD COLUMN IF NOT EXISTS min_subtotal_cents INTEGER NOT NULL DEFAULT 0`);
    await query(`
      ALTER TABLE promotion ADD CONSTRAINT promotion_type_check
        CHECK (type IN ('3x2','2x1','bundle_qty','second_unit','percent','fixed','bundle','free_shipping','tiered'))
    `);
    result.migrated_promotion_v2 = true;
  }
  if (action === "clean_footer_links") {
    const r = await query(
      `DELETE FROM nav_link WHERE location = 'footer' AND (href = '/admin' OR href LIKE '%github%') RETURNING id, label`
    );
    result.deleted_footer_links = r.rows;
  }
  if (action === "inspect_customer_table") {
    const r = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'customer' ORDER BY ordinal_position`
    );
    result.customer_columns = r.rows;
  }
  if (action === "inspect_promotion_table") {
    const r = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'promotion' ORDER BY ordinal_position`
    );
    result.promotion_columns = r.rows;
  }
  if (action === "list_promos") {
    const r = await query(
      `SELECT id, slug, title, type, value, bundle_price_cents, required_size_ml, mix_sizes,
              quantity_to_take, quantity_to_pay, min_subtotal_cents, active, sort_order
       FROM promotion ORDER BY sort_order ASC`
    );
    result.promos = r.rows;
  }
  if (action === "fix_kit_discovery") {
    // Corrige el "Kit Discovery" que está mal configurado como 3x2
    // pero realmente debería ser bundle_qty (3 por $290)
    const r = await query(
      `UPDATE promotion SET
        type = 'bundle_qty',
        value = 0,
        bundle_price_cents = 29000,
        quantity_to_take = 3,
        quantity_to_pay = 3,
        required_size_ml = 10,
        mix_sizes = FALSE,
        title = 'Kit Discovery · 3 fragancias de 10ml por $290',
        slug = 'kit-discovery-3-10ml-290',
        subtitle = 'Arma tu kit discovery con 3 fragancias de 10ml por solo $290',
        badge_text = 'KIT $290',
        updated_at = NOW()
      WHERE slug = '3x2-perfumes-60ml' AND title = 'Kit Discovery'
      RETURNING *`
    );
    result.fixed = r.rows;
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

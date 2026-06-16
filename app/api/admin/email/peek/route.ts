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

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

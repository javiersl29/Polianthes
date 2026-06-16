import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email/peek
 * Endpoint temporal de diagnóstico para ver el estado de las notificaciones
 * y, si ?disable_2fa=1&secret=... viene, desactiva 2FA.
 * Protegido por header x-bootstrap-secret.
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

  if (action === "disable_2fa") {
    const r = await query(
      `UPDATE admin_user SET totp_enabled = FALSE, totp_secret = NULL WHERE username = 'admin' RETURNING id, username`
    );
    result.disabled_2fa = r.rows;
  }
  if (action === "reset_email" && url.searchParams.get("from")) {
    const newFrom = url.searchParams.get("from");
    await query(`UPDATE email_config SET from_email = $1, updated_at = NOW() WHERE id = 1`, [newFrom]);
    result.updated_from = newFrom;
  }
  if (action === "activate_email") {
    await query(`UPDATE email_config SET active = TRUE, updated_at = NOW() WHERE id = 1`);
    result.activated = true;
  }
  if (action === "set_from_name" && url.searchParams.get("name")) {
    const name = url.searchParams.get("name");
    await query(`UPDATE email_config SET from_name = $1, updated_at = NOW() WHERE id = 1`, [name]);
    result.updated_from_name = name;
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

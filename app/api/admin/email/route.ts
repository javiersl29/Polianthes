import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await query<{
    id: number; provider: string; from_email: string; from_name: string;
    resend_api_key: string | null; smtp_host: string | null; smtp_port: number;
    smtp_user: string | null; smtp_secure: boolean; active: boolean;
  }>(
    `SELECT id, provider, from_email, from_name, resend_api_key, smtp_host, smtp_port,
            smtp_user, smtp_secure, active, updated_at FROM email_config WHERE id = 1`
  );
  const row = r.rows[0] ?? null;
  // Enmascarar API key
  if (row?.resend_api_key) {
    const k = row.resend_api_key;
    row.resend_api_key = k.length > 12 ? `${k.slice(0, 6)}…${"•".repeat(20)}${k.slice(-4)}` : "••••";
  }
  if (row?.smtp_user) {
    // smtp_user no es tan sensible, lo dejamos
  }
  return NextResponse.json({ config: row });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (body.provider === "resend" || body.provider === "smtp" || body.provider === "none") {
    patch.provider = body.provider;
  }
  if (typeof body.from_email === "string" && body.from_email.trim()) patch.from_email = body.from_email.trim();
  if (typeof body.from_name === "string" && body.from_name.trim()) patch.from_name = body.from_name.trim();
  if (typeof body.smtp_host === "string" && body.smtp_host.trim()) patch.smtp_host = body.smtp_host.trim();
  if (typeof body.smtp_user === "string" && body.smtp_user.trim()) patch.smtp_user = body.smtp_user.trim();
  if (typeof body.smtp_port === "number") patch.smtp_port = body.smtp_port;
  if (typeof body.smtp_secure === "boolean") patch.smtp_secure = body.smtp_secure;
  if (typeof body.active === "boolean") patch.active = body.active;

  // resend_api_key: sólo actualizar si viene un valor real (no enmascarado)
  if (typeof body.resend_api_key === "string" && body.resend_api_key.trim() && !body.resend_api_key.includes("…")) {
    patch.resend_api_key = body.resend_api_key.trim();
  }

  const cols = Object.keys(patch).map((_, i) => `$${i + 1}`);
  const vals = Object.values(patch);
  if (vals.length === 0) return NextResponse.json({ ok: true, message: "nada que actualizar" });

  vals.push(1); // WHERE id = 1
  const setClause = Object.keys(patch).map((k, i) => `${k} = $${i + 1}`).join(", ");
  await query(
    `UPDATE email_config SET ${setClause}, updated_at = NOW() WHERE id = $${vals.length}`,
    vals
  );
  return NextResponse.json({ ok: true });
}

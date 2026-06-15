import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, logout } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateTotpSecret, generateQrCodeDataUrl, verifyTotpToken } from "@/lib/totp";

export const dynamic = "force-dynamic";

/**
 * GET: estado actual del 2FA para el usuario logueado.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "sin sesión" }, { status: 401 });

  const r = await query<{ totp_enabled: boolean; username: string }>(
    `SELECT totp_enabled, username FROM admin_user WHERE id = $1`,
    [userId]
  );
  if (r.rows.length === 0) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });

  return NextResponse.json({
    enabled: r.rows[0].totp_enabled,
    username: r.rows[0].username
  });
}

/**
 * POST: gestiona el ciclo de vida del 2FA.
 *
 * Body action=setup → genera secret + QR (no activa todavía)
 * Body action=confirm + code → verifica el código y ACTIVA 2FA
 * Body action=disable + code → verifica código y DESACTIVA 2FA
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "sin sesión" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    action?: "setup" | "confirm" | "disable";
    code?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action requerido" }, { status: 400 });
  }

  // === SETUP: generar secret temporal (no guardar todavía) ===
  if (body.action === "setup") {
    const userR = await query<{ username: string }>(
      `SELECT username FROM admin_user WHERE id = $1`,
      [userId]
    );
    if (userR.rows.length === 0) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });

    const secret = generateTotpSecret();
    const qrDataUrl = await generateQrCodeDataUrl(secret, userR.rows[0].username);

    // Guardar el secret temporalmente (aún no habilitado)
    await query(
      `UPDATE admin_user SET totp_secret = $1 WHERE id = $2`,
      [secret, userId]
    );

    return NextResponse.json({
      ok: true,
      secret,
      qr_data_url: qrDataUrl,
      manual_entry: secret.replace(/(.{4})/g, "$1 ").trim()
    });
  }

  // === CONFIRM: verificar código y activar 2FA ===
  if (body.action === "confirm") {
    if (!body.code) return NextResponse.json({ error: "code requerido" }, { status: 400 });

    const r = await query<{ totp_secret: string | null; totp_enabled: boolean }>(
      `SELECT totp_secret, totp_enabled FROM admin_user WHERE id = $1`,
      [userId]
    );
    if (r.rows.length === 0) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    if (!r.rows[0].totp_secret) return NextResponse.json({ error: "Primero ejecuta setup" }, { status: 400 });
    if (r.rows[0].totp_enabled) return NextResponse.json({ error: "2FA ya está activado" }, { status: 400 });

    if (!verifyTotpToken(body.code, r.rows[0].totp_secret)) {
      return NextResponse.json({ error: "Código incorrecto. Verifica que tu app muestre el mismo código." }, { status: 400 });
    }

    await query(`UPDATE admin_user SET totp_enabled = TRUE WHERE id = $1`, [userId]);

    return NextResponse.json({ ok: true, message: "2FA activado correctamente" });
  }

  // === DISABLE: verificar código y desactivar 2FA ===
  if (body.action === "disable") {
    if (!body.code) return NextResponse.json({ error: "code requerido" }, { status: 400 });

    const r = await query<{ totp_secret: string | null; totp_enabled: boolean }>(
      `SELECT totp_secret, totp_enabled FROM admin_user WHERE id = $1`,
      [userId]
    );
    if (r.rows.length === 0) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    if (!r.rows[0].totp_enabled) return NextResponse.json({ error: "2FA no está activado" }, { status: 400 });
    if (!r.rows[0].totp_secret) return NextResponse.json({ error: "No hay secret configurado" }, { status: 400 });

    if (!verifyTotpToken(body.code, r.rows[0].totp_secret)) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    await query(
      `UPDATE admin_user SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({ ok: true, message: "2FA desactivado" });
  }

  return NextResponse.json({ error: "action inválido" }, { status: 400 });
}

/**
 * Obtiene el ID del usuario actual desde la cookie de sesión.
 */
async function getCurrentUserId(): Promise<number | null> {
  const cookieModule = await import("next/headers");
  const cookie = cookieModule.cookies().get("polianthes_admin")?.value;
  if (!cookie) return null;
  const [id] = cookie.split(":");
  if (!id) return null;
  return Number(id);
}

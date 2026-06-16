import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google?redirect=/checkout
 * Redirige al usuario a Google para autenticarse.
 * Si el email coincide con ADMIN_GOOGLE_EMAIL, se le dará sesión de admin.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth no está configurado" }, { status: 500 });
  }

  // Usar X-Forwarded-* si estamos detrás de un proxy (Railway, etc.)
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  // state para CSRF + datos del redirect
  const stateRaw = randomBytes(16).toString("hex");
  const stateData = JSON.stringify({ s: stateRaw, r: req.nextUrl.searchParams.get("redirect") || "/" });
  const state = Buffer.from(stateData).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(googleAuthUrl);
}

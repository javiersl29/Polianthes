import { NextRequest, NextResponse } from "next/server";
import {
  setCustomerCookie,
  createOrUpdateCustomerFromGoogle
} from "@/lib/customer-auth";
import { ensureDefaultAdmin, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
};

/**
 * GET /api/auth/google/callback?code=...&state=...
 * Google redirige aquí con el código de autorización.
 * Lo intercambiamos por tokens, obtenemos el perfil, y creamos/actualizamos
 * el cliente. Si el email coincide con ADMIN_GOOGLE_EMAIL, le damos
 * sesión de admin y redirigimos a /admin.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth no está configurado" }, { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/?login=error&reason=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.json({ error: "Falta código de Google" }, { status: 400 });
  }

  const stateB64 = req.nextUrl.searchParams.get("state");
  let redirectAfter = "/";
  if (stateB64) {
    try {
      const decoded = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf8"));
      redirectAfter = decoded.r || "/";
    } catch {
      /* ignore */
    }
  }

  // Usar X-Forwarded-* si estamos detrás de un proxy (Railway, etc.)
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  // 1. Intercambiar code por tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokens.id_token) {
    console.error("[google/callback] token error", tokens);
    return NextResponse.redirect(new URL("/?login=error&reason=token", req.url));
  }

  // 2. Obtener perfil de Google
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token ?? tokens.id_token}` }
  });
  if (!profileRes.ok) {
    console.error("[google/callback] profile error", profileRes.status);
    return NextResponse.redirect(new URL("/?login=error&reason=profile", req.url));
  }
  const profile = (await profileRes.json()) as GoogleUserInfo;
  if (!profile.email || !profile.sub) {
    return NextResponse.redirect(new URL("/?login=error&reason=incomplete", req.url));
  }

  const email = profile.email.toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_GOOGLE_EMAIL ?? "javicreed@gmail.com").toLowerCase().trim();

  // 3. Si es admin, autenticar como admin (no crear customer)
  if (email === adminEmail) {
    await ensureDefaultAdmin();
    // Asegurar que el admin_user existe con el email correcto
    // (el username sigue siendo "admin", pero el email debe matchear)
    // El admin actual se autentica con admin/polianthes. Aquí le damos
    // sesión de admin directamente porque el email coincide.
    setSessionCookie(1); // ID 1 = admin principal
    const dest = redirectAfter.startsWith("/admin") ? redirectAfter : "/admin";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // 4. Si NO es admin, crear/actualizar customer
  const customer = await createOrUpdateCustomerFromGoogle({
    googleId: profile.sub,
    email,
    name: profile.name || profile.given_name || email.split("@")[0],
    pictureUrl: profile.picture ?? null
  });

  setCustomerCookie(customer.id);

  // 5. Redirigir
  // - Si redirectAfter empieza con /admin, forzar a /cuenta (cliente no admin)
  const dest = redirectAfter.startsWith("/admin") ? "/cuenta" : redirectAfter;
  // - Si el cliente es nuevo, mostrar modal de afiliación
  const isNew = await isNewlyCreated(profile.sub);
  const sep = dest.includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  if (isNew) params.set("affiliate", "prompt");
  params.set("login", "ok");
  return NextResponse.redirect(new URL(`${dest}${sep}${params.toString()}`, req.url));
}

async function isNewlyCreated(googleId: string): Promise<boolean> {
  // Si el customer fue creado hace menos de 1 minuto, es nuevo
  const r = await import("@/lib/db");
  const res = await r.query<{ created_at: string }>(
    `SELECT created_at FROM customer WHERE google_id = $1`,
    [googleId]
  );
  if (res.rows.length === 0) return false;
  const created = new Date(res.rows[0].created_at).getTime();
  return Date.now() - created < 60_000;
}

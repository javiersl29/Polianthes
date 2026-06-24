import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerEmail, setCustomerCookie } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/customer/verify-email?token=...
 * Verifica el email de un cliente usando el token enviado por correo.
 * Si tiene éxito, inicia sesión y redirige a /cuenta?verified=1.
 * Si falla, redirige a /login?error=invalid_token.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(absoluteUrl(req, "/login?error=missing_token"));
  }

  const customer = await verifyCustomerEmail(token);
  if (!customer) {
    return NextResponse.redirect(absoluteUrl(req, "/login?error=invalid_or_expired"));
  }

  // Iniciar sesión automáticamente
  setCustomerCookie(customer.id);
  return NextResponse.redirect(absoluteUrl(req, "/cuenta?verified=1"));
}

/**
 * Construye una URL absoluta respetando los headers del proxy (Railway).
 * req.url en producción viene como http://localhost:8080/...
 * por lo que hay que reconstruir el protocolo y host desde los headers.
 */
function absoluteUrl(req: NextRequest, path: string): URL {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return new URL(path, `${proto}://${host}`);
}
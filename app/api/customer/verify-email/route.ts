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
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const customer = await verifyCustomerEmail(token);
  if (!customer) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", req.url));
  }

  // Iniciar sesión automáticamente
  setCustomerCookie(customer.id);
  return NextResponse.redirect(new URL("/cuenta?verified=1", req.url));
}

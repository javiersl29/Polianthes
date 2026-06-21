import { NextRequest, NextResponse } from "next/server";
import { loginCustomerWithPassword, setCustomerCookie } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/login
 * Body: { email, password }
 * Inicia sesión con email/password.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
  }

  try {
    const customer = await loginCustomerWithPassword(email, password);
    setCustomerCookie(customer.id);
    return NextResponse.json({
      ok: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        email_verified: customer.email_verified
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos" },
        { status: 401 }
      );
    }
    if (msg === "GOOGLE_ONLY_ACCOUNT") {
      return NextResponse.json(
        { error: "Esta cuenta se creó con Google. Usa 'Continuar con Google' para entrar." },
        { status: 409 }
      );
    }
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}

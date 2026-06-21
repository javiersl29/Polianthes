import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken, setCustomerCookie, findCustomerByEmail } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/reset-password
 * Body: { token, password }
 * Restablece la contraseña usando el token enviado por email.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (password.length > 100) {
    return NextResponse.json({ error: "La contraseña es demasiado larga" }, { status: 400 });
  }

  const ok = await resetPasswordWithToken(token, password);
  if (!ok) {
    return NextResponse.json(
      { error: "El enlace no es válido o ha expirado. Solicita uno nuevo." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, message: "Contraseña restablecida. Ya puedes iniciar sesión." });
}

import { NextRequest, NextResponse } from "next/server";
import { initiatePasswordReset } from "@/lib/customer-auth";
import { sendPasswordResetEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/forgot-password
 * Body: { email }
 * Inicia el flujo de recuperación de contraseña.
 * Por seguridad, siempre devuelve ok=true incluso si el email no existe.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  const result = await initiatePasswordReset(email);
  if (result) {
    const emailResult = await sendPasswordResetEmail(email, result.name, result.token);
    if (!emailResult.ok) {
      console.error("[forgot-password] email send failed:", emailResult.message);
    }
  }
  // Por seguridad: siempre responder ok (no revelar si el email existe)
  return NextResponse.json({
    ok: true,
    message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
  });
}

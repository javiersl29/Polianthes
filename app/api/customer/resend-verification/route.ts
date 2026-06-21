import { NextRequest, NextResponse } from "next/server";
import { getCurrentCustomer, resendVerification } from "@/lib/customer-auth";
import { sendEmailVerification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/resend-verification
 * Reenvía el email de confirmación al cliente autenticado.
 */
export async function POST() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (customer.email_verified) {
    return NextResponse.json({ error: "Tu correo ya está confirmado" }, { status: 400 });
  }

  const result = await resendVerification(customer.id);
  if (!result) {
    return NextResponse.json({ error: "No se pudo reenviar el correo" }, { status: 400 });
  }

  const emailResult = await sendEmailVerification(customer.email, customer.name, result.token);
  return NextResponse.json({
    ok: true,
    email_sent: emailResult.ok,
    message: emailResult.ok
      ? "Te enviamos un nuevo correo de confirmación."
      : "No pudimos enviar el email. Intenta de nuevo más tarde."
  });
}

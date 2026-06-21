import { NextRequest, NextResponse } from "next/server";
import { createCustomerFromEmail, setCustomerCookie } from "@/lib/customer-auth";
import { sendEmailVerification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_+'\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

/**
 * POST /api/customer/register
 * Body: { email, password, name }
 * Crea un cliente con email/password, envía email de confirmación y
 * establece sesión (aunque el email no esté verificado todavía — el cliente
 * puede navegar pero se le mostrará un banner pidiendo confirmación).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Correo electrónico inválido" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (password.length > 100) {
    return NextResponse.json({ error: "La contraseña es demasiado larga" }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  try {
    const { customer, token } = await createCustomerFromEmail({ email, password, name });

    // Enviar email de confirmación (no bloquear si falla)
    const emailResult = await sendEmailVerification(email, name, token);
    if (!emailResult.ok) {
      console.error("[register] email send failed:", emailResult.message);
    }

    // Establecer sesión (el cliente puede navegar aunque no esté verificado)
    setCustomerCookie(customer.id);

    return NextResponse.json({
      ok: true,
      customer: { id: customer.id, email: customer.email, name: customer.name, email_verified: customer.email_verified },
      email_sent: emailResult.ok,
      message: emailResult.ok
        ? "Cuenta creada. Te enviamos un correo para confirmar tu cuenta."
        : "Cuenta creada, pero no pudimos enviar el email de confirmación. Puedes solicitarlo de nuevo desde tu cuenta."
    });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo. Intenta iniciar sesión." },
        { status: 409 }
      );
    }
    console.error("[register] error:", e);
    return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
  }
}

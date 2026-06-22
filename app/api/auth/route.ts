import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, logout } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Login con usuario/contraseña deshabilitado. Solo se permite
  // autenticación vía Google OAuth (ver /api/auth/google).
  if (action === "login" || action === "verify-2fa") {
    return NextResponse.json(
      { error: "El acceso al panel solo está disponible mediante Google. Usa el botón 'Continuar con Google'." },
      { status: 403 }
    );
  }

  if (action === "logout") {
    logout();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "acción no soportada" }, { status: 400 });
}

export async function GET() {
  return NextResponse.json({ authenticated: isAuthenticated() });
}

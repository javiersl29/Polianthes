import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultAdmin, isAuthenticated, login, logout, verify2Fa } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "login") {
    const { username, password } = (await req.json()) as { username?: string; password?: string };
    if (!username || !password) return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });
    const result = await login(username, password);
    if (result === "fail") return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    if (result === "needs_2fa") return NextResponse.json({ ok: true, needs_2fa: true });
    return NextResponse.json({ ok: true });
  }

  if (action === "verify-2fa") {
    const { code } = (await req.json()) as { code?: string };
    if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    const ok = await verify2Fa(code);
    if (!ok) return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 401 });
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    logout();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "acción no soportada" }, { status: 400 });
}

export async function GET() {
  await ensureDefaultAdmin();
  return NextResponse.json({ authenticated: isAuthenticated() });
}

import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultAdmin, isAuthenticated, login, logout } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action === "login") {
    const { username, password } = (await req.json()) as { username?: string; password?: string };
    if (!username || !password) return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });
    const ok = await login(username, password);
    if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
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

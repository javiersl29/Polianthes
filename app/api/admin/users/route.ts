import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, hashPassword, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { listAdminUsers } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

function genUsername(base: string): string {
  return base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32);
}

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

/**
 * POST: crear nuevo usuario admin.
 * Body: { username, password, name? }
 */
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const username = genUsername(String(body.username ?? "").trim());
  const password = String(body.password ?? "").trim();
  if (username.length < 3) {
    return NextResponse.json({ error: "El usuario debe tener al menos 3 caracteres" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  const exists = await query<{ id: number }>(
    `SELECT id FROM admin_user WHERE username = $1`, [username]
  );
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
  }
  const hash = hashPassword(password);
  const r = await query<{ id: number; username: string; created_at: string }>(
    `INSERT INTO admin_user (username, password_hash) VALUES ($1, $2)
     RETURNING id, username, created_at`,
    [username, hash]
  );
  return NextResponse.json({ user: r.rows[0] });
}

/**
 * PATCH: actualizar usuario (cambiar password, etc.)
 * Body: { id, action: 'reset_password' | 'set_password', password, current_password? }
 */
export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  if (action === "reset_password" || action === "set_password") {
    const newPassword = String(body.password ?? "").trim();
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }
    // Para 'set_password' se requiere la contraseña actual del usuario objetivo.
    if (action === "set_password" && body.current_password) {
      const cur = await query<{ password_hash: string }>(
        `SELECT password_hash FROM admin_user WHERE id = $1`, [id]
      );
      if (cur.rows.length === 0) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }
      if (!verifyPassword(String(body.current_password), cur.rows[0].password_hash)) {
        return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 403 });
      }
    }
    const hash = hashPassword(newPassword);
    await query(`UPDATE admin_user SET password_hash = $1 WHERE id = $2`, [hash, id]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "acción no reconocida" }, { status: 400 });
}

/**
 * DELETE: eliminar usuario (no se puede eliminar el último admin).
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  const count = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM admin_user`);
  if (Number(count.rows[0]?.c ?? 0) <= 1) {
    return NextResponse.json({ error: "No puedes eliminar el último administrador" }, { status: 409 });
  }
  await query(`DELETE FROM admin_user WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

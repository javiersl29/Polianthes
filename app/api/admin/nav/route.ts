import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await query(
    `SELECT * FROM nav_link ORDER BY location, sort_order, id`
  );
  return NextResponse.json({ links: r.rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.label || !body.href) {
    return NextResponse.json({ error: "label y href requeridos" }, { status: 400 });
  }
  const r = await query<{ id: number }>(
    `INSERT INTO nav_link (location, label, href, sort_order, icon, new_tab, admin_only, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      body.location ?? "navbar",
      String(body.label),
      String(body.href),
      Number(body.sort_order ?? 0),
      body.icon ?? null,
      !!body.new_tab,
      !!body.admin_only,
      body.active !== false
    ]
  );
  return NextResponse.json({ id: r.rows[0].id });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await query(
    `UPDATE nav_link
     SET location = $1, label = $2, href = $3, sort_order = $4, icon = $5,
         new_tab = $6, admin_only = $7, active = $8, updated_at = NOW()
     WHERE id = $9`,
    [
      body.location ?? "navbar",
      String(body.label ?? ""),
      String(body.href ?? ""),
      Number(body.sort_order ?? 0),
      body.icon ?? null,
      !!body.new_tab,
      !!body.admin_only,
      body.active !== false,
      id
    ]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await query(`DELETE FROM nav_link WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

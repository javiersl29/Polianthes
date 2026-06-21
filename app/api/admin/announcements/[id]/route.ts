import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const allowed = ["text", "link_url", "link_label", "icon", "bg_color", "sort_order", "active", "starts_at", "ends_at"];
  for (const k of allowed) {
    if (k in body) {
      fields.push(`${k} = $${i}`);
      values.push(body[k]);
      i++;
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  values.push(id);
  const r = await query(
    `UPDATE announcement SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return NextResponse.json({ announcement: r.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  await query(`DELETE FROM announcement WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

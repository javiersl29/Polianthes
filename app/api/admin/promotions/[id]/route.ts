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
  const allowed = [
    "title", "subtitle", "description", "type", "value", "required_size_ml",
    "quantity_to_take", "quantity_to_pay", "image_url", "image_prompt", "image_ai_generated",
    "badge_text", "badge_color", "min_items", "max_items", "starts_at", "ends_at", "active", "sort_order"
  ];
  for (const k of allowed) {
    if (k in body) {
      fields.push(`${k} = $${i}`);
      values.push(body[k]);
      i++;
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: "nada que actualizar" }, { status: 400 });
  fields.push(`updated_at = NOW()`);
  values.push(id);
  const r = await query(
    `UPDATE promotion SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return NextResponse.json({ promotion: r.rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  await query(`DELETE FROM promotion WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

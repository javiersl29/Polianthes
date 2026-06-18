import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await query(
    `SELECT * FROM promotion ORDER BY sort_order ASC, created_at DESC`
  );
  return NextResponse.json({ promotions: r.rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();

  const slug = String(body.slug ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const title = String(body.title ?? "").trim();
  if (!slug || !title) {
    return NextResponse.json({ error: "slug y title son obligatorios" }, { status: 400 });
  }
  const type = String(body.type ?? "bundle");
  const validTypes = ["3x2", "2x1", "bundle_qty", "second_unit", "percent", "fixed", "bundle", "free_shipping", "tiered"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  try {
    const r = await query(
      `INSERT INTO promotion
        (slug, title, subtitle, description, type, value, bundle_price_cents, required_size_ml, mix_sizes,
         quantity_to_take, quantity_to_pay, image_url, image_prompt, image_ai_generated,
         badge_text, badge_color, min_items, max_items, starts_at, ends_at, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        slug,
        title,
        body.subtitle ?? null,
        body.description ?? null,
        type,
        Number(body.value ?? 0),
        Number(body.bundle_price_cents ?? 0),
        Number(body.required_size_ml ?? 0),
        Boolean(body.mix_sizes ?? false),
        Number(body.quantity_to_take ?? 3),
        Number(body.quantity_to_pay ?? 2),
        body.image_url ?? null,
        body.image_prompt ?? null,
        Boolean(body.image_ai_generated ?? false),
        body.badge_text ?? null,
        body.badge_color ?? "gold",
        Number(body.min_items ?? 0),
        Number(body.max_items ?? 0),
        body.starts_at ?? new Date().toISOString(),
        body.ends_at ?? null,
        body.active !== false,
        Number(body.sort_order ?? 0)
      ]
    );
    return NextResponse.json({ promotion: r.rows[0] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}

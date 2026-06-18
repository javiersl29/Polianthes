import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const r = await query(
    `SELECT id, slug, title, subtitle, description, type, value, bundle_price_cents,
            required_size_ml, mix_sizes, quantity_to_take, quantity_to_pay,
            image_url, badge_text, badge_color,
            min_items, max_items, min_subtotal_cents, starts_at, ends_at, sort_order
     FROM promotion
     WHERE slug = $1 AND active = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())`,
    [params.slug]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ promotion: r.rows[0] });
}

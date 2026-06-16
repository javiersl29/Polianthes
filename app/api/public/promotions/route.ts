import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const r = await query<{
    id: number;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    type: string;
    value: number;
    required_size_ml: number;
    quantity_to_take: number;
    quantity_to_pay: number;
    image_url: string | null;
    badge_text: string | null;
    badge_color: string;
    min_items: number;
    max_items: number;
    starts_at: string;
    ends_at: string | null;
    sort_order: number;
  }>(
    `SELECT id, slug, title, subtitle, description, type, value, required_size_ml,
            quantity_to_take, quantity_to_pay, image_url, badge_text, badge_color,
            min_items, max_items, starts_at, ends_at, sort_order
     FROM promotion
     WHERE active = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY sort_order ASC, created_at DESC`
  );
  return NextResponse.json({ promotions: r.rows });
}

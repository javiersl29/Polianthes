import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    const r = await query<{
      id: number; text: string; link_url: string | null; link_label: string;
      icon: string; bg_color: string; sort_order: number;
    }>(
      `SELECT id, text, link_url, link_label, icon, bg_color, sort_order
       FROM announcement
       WHERE active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY sort_order ASC
       LIMIT 10`
    );
    return NextResponse.json({ announcements: r.rows });
  } catch {
    return NextResponse.json({ announcements: [] });
  }
}

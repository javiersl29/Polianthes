import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await query(`SELECT * FROM announcement ORDER BY sort_order ASC, created_at DESC`);
  return NextResponse.json({ announcements: r.rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text es obligatorio" }, { status: 400 });

  const validColors = ["gold", "rose", "emerald", "sky", "violet", "dark"];
  const bgColor = validColors.includes(body.bg_color) ? body.bg_color : "gold";

  const r = await query(
    `INSERT INTO announcement (text, link_url, link_label, icon, bg_color, sort_order, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      text,
      body.link_url ?? null,
      body.link_label ?? "Ver más",
      body.icon ?? "🎁",
      bgColor,
      Number(body.sort_order ?? 0),
      body.active !== false
    ]
  );
  return NextResponse.json({ announcement: r.rows[0] });
}

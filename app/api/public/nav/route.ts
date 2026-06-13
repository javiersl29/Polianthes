import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/nav?location=navbar|footer|mobile
 * Devuelve los enlaces visibles para el público.
 */
export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location") ?? "navbar";
  if (!["navbar", "footer", "mobile"].includes(location)) {
    return NextResponse.json({ error: "location inválido" }, { status: 400 });
  }
  const r = await query<{
    id: number;
    label: string;
    href: string;
    icon: string | null;
    new_tab: boolean;
    sort_order: number;
  }>(
    `SELECT id, label, href, icon, new_tab, sort_order
     FROM nav_link
     WHERE location = $1 AND active = TRUE AND admin_only = FALSE
     ORDER BY sort_order, id`,
    [location]
  );
  return NextResponse.json({ links: r.rows });
}

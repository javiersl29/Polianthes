import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reviews?status=pending|approved|rejected|all
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const where = status === "all" ? "" : `WHERE r.status = $1`;
  const params = status === "all" ? [] : [status];
  const r = await query(
    `SELECT r.*, f.slug AS fragrance_slug, f.brand, f.name, f.full_name, f.artistic_name,
            CASE WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug ELSE NULL END AS image_url
     FROM review r
     JOIN fragrance f ON f.id = r.fragrance_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return NextResponse.json({ reviews: r.rows, count: r.rows.length });
}

/**
 * PATCH /api/admin/reviews
 * Body: { id, action: 'approve' | 'reject' | 'respond', response?, reason? }
 */
export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  if (action === "approve") {
    await query(
      `UPDATE review SET status = 'approved', moderated_at = NOW(), rejected_reason = NULL WHERE id = $1`,
      [id]
    );
  } else if (action === "reject") {
    await query(
      `UPDATE review SET status = 'rejected', moderated_at = NOW(), rejected_reason = $2 WHERE id = $1`,
      [id, String(body.reason ?? "")]
    );
  } else if (action === "respond") {
    await query(
      `UPDATE review SET admin_response = $2, updated_at = NOW() WHERE id = $1`,
      [id, String(body.response ?? "")]
    );
  } else if (action === "delete") {
    await query(`DELETE FROM review WHERE id = $1`, [id]);
  } else {
    return NextResponse.json({ error: "acción inválida" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

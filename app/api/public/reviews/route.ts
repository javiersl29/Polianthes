import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logSearch } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/reviews?slug=...&status=approved
 * Lista reseñas aprobadas (o todas) para una fragancia.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const status = req.nextUrl.searchParams.get("status") ?? "approved";
  if (!slug) {
    return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  }
  const allowedStatus = status === "all" ? null : "approved";
  const r = await query(
    `SELECT r.id, r.author_name, r.rating, r.title, r.body, r.verified_purchase,
            r.admin_response, r.created_at,
            r.fragrance_id, f.slug
     FROM review r
     JOIN fragrance f ON f.id = r.fragrance_id
     WHERE f.slug = $1 ${allowedStatus ? "AND r.status = 'approved'" : ""}
     ORDER BY r.created_at DESC`,
    [slug]
  );
  const rows = r.rows as Array<{ rating: number }>;
  const avg = rows.length > 0 ? rows.reduce((s, x) => s + Number(x.rating), 0) / rows.length : 0;
  return NextResponse.json({
    reviews: r.rows,
    count: r.rows.length,
    average_rating: Math.round(avg * 10) / 10
  });
}

/**
 * POST /api/public/reviews
 * Crea una reseña pendiente de moderación.
 * Body: { slug, author_name, author_email?, rating (1-5), title?, body? }
 *
 * Anti-spam básico: hash de IP + rate-limit por email+slug.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = String(body.slug ?? "").trim();
  const authorName = String(body.author_name ?? "").trim();
  const authorEmail = body.author_email ? String(body.author_email).trim().toLowerCase() : null;
  const rating = Number(body.rating);
  const title = body.title ? String(body.title).trim().slice(0, 120) : null;
  const reviewBody = body.body ? String(body.body).trim().slice(0, 2000) : null;

  if (!slug || authorName.length < 2 || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if ((!reviewBody || reviewBody.length < 10) && (!title || title.length < 3)) {
    return NextResponse.json({ error: "Escribe un comentario de al menos 10 caracteres" }, { status: 400 });
  }

  // Buscar fragrance_id
  const f = await query<{ id: number }>(`SELECT id FROM fragrance WHERE slug = $1 AND active = TRUE`, [slug]);
  if (f.rows.length === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  const fragranceId = f.rows[0].id;

  // Hash de IP para anti-spam (no guardar IP real)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const crypto = await import("node:crypto");
  const ipHash = crypto.createHash("sha256").update(ip + (process.env.ADMIN_SESSION_SECRET || "salt")).digest("hex").slice(0, 32);

  // Rate-limit: máximo 3 reseñas por IP+fragancia en 24h
  const recent = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM review
     WHERE fragrance_id = $1 AND ip_hash = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
    [fragranceId, ipHash]
  );
  if (Number(recent.rows[0]?.c ?? 0) >= 3) {
    return NextResponse.json({ error: "Demasiadas reseñas. Intenta más tarde." }, { status: 429 });
  }

  try {
    const r = await query<{ id: number }>(
      `INSERT INTO review (fragrance_id, author_name, author_email, rating, title, body, status, ip_hash, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'web')
       RETURNING id`,
      [fragranceId, authorName, authorEmail, rating, title, reviewBody, ipHash]
    );
    return NextResponse.json({
      ok: true,
      id: r.rows[0].id,
      message: "Reseña enviada. Se publicará tras revisión."
    });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo guardar la reseña" }, { status: 500 });
  }
}

// Avoid unused import
void logSearch;

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/admin/upload
 * Body: { slug, dataUrl }
 *
 * Guarda la imagen como data URL en la columna `image_data` de la fragancia
 * (persistente en Postgres) y apunta `image_url` a `/api/image/{slug}` para
 * que el catálogo público la sirva correctamente.
 *
 * Esto reemplaza el flujo anterior que escribía a disco (`public/fragancias/`)
 * el cual se perdía tras cada redeploy de Railway y era ignorado por el query
 * público que filtra `image_url LIKE '/fragancias/%'`.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { slug, dataUrl } = (await req.json()) as { slug?: string; dataUrl?: string };
  if (!slug || !dataUrl) return NextResponse.json({ error: "slug y dataUrl requeridos" }, { status: 400 });

  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "dataUrl inválido. Formato esperado: data:image/png;base64,..." }, { status: 400 });

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return NextResponse.json({ error: `Imagen demasiado grande (${(approxBytes / 1024 / 1024).toFixed(1)} MB). Máximo 10 MB.` }, { status: 413 });
  }

  const publicPath = `/api/image/${slug}`;
  const result = await query(
    `UPDATE fragrance SET image_data = $1, image_url = $2 WHERE slug = $3`,
    [dataUrl, publicPath, slug]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, image_url: publicPath, size_bytes: approxBytes });
}

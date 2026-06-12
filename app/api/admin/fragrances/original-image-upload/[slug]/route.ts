import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/fragrances/original-image-upload/[slug]
 * Sube manualmente una imagen de referencia (base64) para una fragancia.
 * Body: { data_url: string, source?: string }
 * El data_url debe tener formato data:image/...;base64,...
 */
export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const slug = ctx.params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as
    | { data_url?: string; source?: string; clear?: boolean }
    | null;
  if (!body) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Opción clear: borrar la imagen guardada
  if (body.clear === true) {
    await query(
      `UPDATE fragrance
       SET original_image_data = NULL,
           original_image_url = NULL,
           original_image_source = NULL,
           original_image_fetched_at = NULL
       WHERE slug = $1 AND active = TRUE`,
      [slug]
    );
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!body.data_url) {
    return NextResponse.json({ error: "data_url requerido" }, { status: 400 });
  }

  // Validar formato data URL
  const m = body.data_url.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.{100,})/);
  if (!m) {
    return NextResponse.json(
      { error: "data_url malformado (debe ser data:image/...;base64,...)" },
      { status: 400 }
    );
  }
  const mime = m[1];
  const b64 = m[2];
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: `Imagen demasiado grande (${(approxBytes / 1024 / 1024).toFixed(1)} MB, max 10MB)` },
      { status: 400 }
    );
  }

  const source = body.source ?? "manual_upload";
  await query(
    `UPDATE fragrance
     SET original_image_data = $1,
         original_image_source = $2,
         original_image_fetched_at = NOW()
     WHERE slug = $3 AND active = TRUE`,
    [body.data_url, source, slug]
  );
  return NextResponse.json({
    ok: true,
    saved: true,
    mime_type: mime,
    size_bytes: approxBytes,
    source
  });
}

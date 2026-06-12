import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { original_image_data: string | null };

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  if (!(await isAuthenticated())) {
    return new NextResponse(null, { status: 401 });
  }
  const slug = ctx.params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse(null, { status: 400 });
  }
  const r = await query<Row>(
    `SELECT original_image_data FROM fragrance WHERE slug = $1`,
    [slug]
  );
  const data = r.rows[0]?.original_image_data;
  if (!data) {
    return new NextResponse(null, { status: 404 });
  }
  const m = data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) {
    return new NextResponse(null, { status: 500 });
  }
  const buf = Buffer.from(m[2], "base64");
  // max-age=0 + must-revalidate fuerza al navegador a revalidar en cada
  // request, garantizando que la imagen actualizada se vea inmediatamente
  // después de subir. El ETag basado en el tamaño y fecha de fetched_at
  // también ayuda a invalidar cuando cambia el contenido.
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "private, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

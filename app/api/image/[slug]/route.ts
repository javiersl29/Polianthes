import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { image_data: string | null };

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse(null, { status: 400 });
  }
  const r = await query<Row>(`SELECT image_data FROM fragrance WHERE slug = $1`, [slug]);
  const data = r.rows[0]?.image_data;
  if (!data) {
    return new NextResponse(null, { status: 404 });
  }
  const m = data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) {
    return new NextResponse(null, { status: 500 });
  }
  const buf = Buffer.from(m[2], "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": m[1],
      // 5 minutos: tiempo suficiente para que el catálogo público cachee
      // (perfume = 1 actualización cada varios días) y lo suficientemente
      // corto para que el admin vea la nueva imagen al guardar sin
      // recargar manualmente. NO usar `immutable` porque si un admin
      // sube una nueva imagen, el navegador/CDN no debe seguir sirviendo
      // la versión vieja 24h. El `must-revalidate` fuerza re-fetch si la
      // copia está stale.
      "Cache-Control": "public, max-age=300, must-revalidate"
    }
  });
}

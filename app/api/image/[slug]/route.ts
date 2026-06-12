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
      // `no-store` porque el endpoint SIEMPRE lee de la DB (force-dynamic)
      // y queremos que el catálogo público vea la imagen más reciente al
      // instante cuando un admin guarda una nueva. Sin esto, los clientes
      // que tenían la versión vieja en su cache seguían viéndola 5 min
      // después del update del admin. El "costo" de `no-store` es que el
      // cliente público hace 1 request por cada <img> en cada page load,
      // pero la respuesta es solo 1 SQL query + binario — perfectamente
      // manejable para 146 fragancias.
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}

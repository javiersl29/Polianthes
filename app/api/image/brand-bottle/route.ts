import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await query<{ image_data: string; mime_type: string }>(
    `SELECT image_data, mime_type FROM brand_bottle_image WHERE id = 1`
  );
  const row = r.rows[0];
  if (!row?.image_data) {
    return new NextResponse(null, { status: 404 });
  }
  const m = row.image_data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) {
    return new NextResponse(null, { status: 500 });
  }
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=300"
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

type BrandBottleRow = {
  id: number;
  image_data: string | null;
  filename: string | null;
  mime_type: string;
  updated_at: string;
};

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const r = await query<BrandBottleRow>(
    `SELECT id, image_data, filename, mime_type, updated_at
     FROM brand_bottle_image WHERE id = 1`
  );
  const row = r.rows[0] ?? null;
  if (!row) {
    return NextResponse.json({ has_image: false });
  }
  return NextResponse.json({
    has_image: Boolean(row.image_data),
    filename: row.filename,
    mime_type: row.mime_type,
    size_bytes: row.image_data
      ? Math.floor((row.image_data.length * 3) / 4) // base64 → bytes (aprox)
      : 0,
    updated_at: row.updated_at
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { data_url?: string; filename?: string; mime_type?: string; clear?: boolean }
    | null;
  if (!body) {
    return NextResponse.json({ error: "body requerido" }, { status: 400 });
  }

  if (body.clear === true) {
    await query(
      `UPDATE brand_bottle_image
       SET image_data = NULL, filename = NULL, updated_at = NOW()
       WHERE id = 1`
    );
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!body.data_url || !body.data_url.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "data_url inválida (debe ser data:image/...)" },
      { status: 400 }
    );
  }
  // extraer mime y validar
  const mimeMatch = body.data_url.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!mimeMatch) {
    return NextResponse.json({ error: "formato data URL inválido" }, { status: 400 });
  }
  const mime = mimeMatch[1].toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json(
      { error: `mime_type no soportado: ${mime}. Usa ${ALLOWED_MIME.join(", ")}` },
      { status: 400 }
    );
  }
  const b64 = mimeMatch[2];
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `imagen demasiado grande (${(approxBytes / 1024 / 1024).toFixed(1)} MB, máx ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }

  await query(
    `UPDATE brand_bottle_image
     SET image_data = $1, filename = $2, mime_type = $3, updated_at = NOW()
     WHERE id = 1`,
    [body.data_url, body.filename ?? null, mime]
  );

  return NextResponse.json({
    ok: true,
    saved: true,
    mime_type: mime,
    filename: body.filename ?? null,
    size_bytes: approxBytes
  });
}

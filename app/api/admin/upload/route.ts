import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { slug, dataUrl } = (await req.json()) as { slug?: string; dataUrl?: string };
  if (!slug || !dataUrl) return NextResponse.json({ error: "slug y dataUrl requeridos" }, { status: 400 });

  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "dataUrl inválido" }, { status: 400 });
  const ext = match[1].toLowerCase().replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2], "base64");

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "fragancias");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${slug}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  const pool = getPool();
  const localPath = `/fragancias/${filename}`;
  await pool.query(`UPDATE fragrance SET image_url = $1 WHERE slug = $2`, [localPath, slug]);
  return NextResponse.json({ ok: true, image_url: localPath });
}

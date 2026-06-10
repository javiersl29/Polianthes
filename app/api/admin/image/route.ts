import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type PexelsPhoto = { src?: { large?: string; medium?: string; original?: string } };

async function fromPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photo = data.photos?.[0];
    return photo?.src?.large ?? photo?.src?.medium ?? photo?.src?.original ?? null;
  } catch {
    return null;
  }
}

async function persistImage(url: string, slug: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Polianthes/1.0" } });
  if (!res.ok) throw new Error(`image download ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "fragancias");
  await fs.mkdir(dir, { recursive: true });
  const ext = url.includes(".png") ? "png" : "jpg";
  const filename = `${slug}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/fragancias/${filename}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { slug } = (await req.json()) as { slug?: string };
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });

  const pool = getPool();
  const result = await pool.query<{ id: number; brand: string; name: string }>(
    `SELECT id, brand, name FROM fragrance WHERE slug = $1`,
    [slug]
  );
  if (result.rows.length === 0) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
  const frag = result.rows[0];
  const query = `${frag.brand} ${frag.name} perfume bottle`;
  const url = await fromPexels(query);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "No se pudo obtener imagen. Verifica que PEXELS_API_KEY esté configurada en el panel Railway → Variables."
      },
      { status: 404 }
    );
  }
  const localPath = await persistImage(url, slug);
  await pool.query(`UPDATE fragrance SET image_url = $1 WHERE id = $2`, [localPath, frag.id]);
  return NextResponse.json({ ok: true, image_url: localPath, source_url: url });
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  const pool = getPool();
  const result = await pool.query<{ id: number; brand: string; name: string }>(
    `SELECT id, brand, name FROM fragrance WHERE slug = $1`,
    [slug]
  );
  if (result.rows.length === 0) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
  const query = `${result.rows[0].brand} ${result.rows[0].name} perfume bottle`;
  const url = await fromPexels(query);
  return NextResponse.json({ preview: url, has_pexels_key: !!process.env.PEXELS_API_KEY });
}

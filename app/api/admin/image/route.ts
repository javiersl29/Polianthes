import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function fromPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`, {
      headers: { Authorization: key }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: { src?: { large?: string; medium?: string } }[] };
    return data.photos?.[0]?.src?.large ?? data.photos?.[0]?.src?.medium ?? null;
  } catch {
    return null;
  }
}

async function fromWikimedia(query: string): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&iiurlwidth=800`;
    const res = await fetch(url, { headers: { "User-Agent": "Polianthes/1.0" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { iiurl?: string }[] }> } };
    const pages = data.query?.pages ?? {};
    const first = Object.values(pages)[0];
    return first?.imageinfo?.[0]?.iiurl ?? null;
  } catch {
    return null;
  }
}

async function searchImage(query: string): Promise<string | null> {
  return (await fromPexels(query)) ?? (await fromWikimedia(query));
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
  const result = await pool.query<{ id: number; brand: string; name: string; full_name: string }>(
    `SELECT id, brand, name, full_name FROM fragrance WHERE slug = $1`,
    [slug]
  );
  if (result.rows.length === 0) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
  const frag = result.rows[0];
  const query = `${frag.brand} ${frag.name} perfume`;
  const url = await searchImage(query);
  if (!url) {
    return NextResponse.json(
      {
        error: "No se encontró imagen. Configura PEXELS_API_KEY o agrega manualmente la URL."
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
  const query = `${result.rows[0].brand} ${result.rows[0].name} perfume`;
  const url = await searchImage(query);
  return NextResponse.json({ preview: url });
}

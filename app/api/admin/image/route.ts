import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type UnsplashHit = {
  id: string;
  urls: { small: string; regular: string };
  alt_description?: string;
};

async function searchUnsplash(query: string): Promise<string | null> {
  // 1) Unsplash Source (sin API key): redirige a una imagen random basada en la query.
  // Útil como fallback rápido. Devuelve 302 → URL firmada.
  try {
    const src = `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`;
    const head = await fetch(src, { method: "HEAD", redirect: "manual" });
    const loc = head.headers.get("location");
    if (loc) return loc;
  } catch {
    /* ignore */
  }
  return null;
}

async function persistImage(url: string, slug: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unsplash download ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "fragancias");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${slug}.jpg`;
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
  const query = `${frag.brand} ${frag.name} perfume bottle`.trim();
  const url = await searchUnsplash(query);
  if (!url) return NextResponse.json({ error: "no se encontró imagen" }, { status: 404 });
  const localPath = await persistImage(url, slug);
  await pool.query(`UPDATE fragrance SET image_url = $1 WHERE id = $2`, [localPath, frag.id]);
  return NextResponse.json({ ok: true, image_url: localPath });
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
  const query = `${result.rows[0].brand} ${result.rows[0].name} perfume bottle`.trim();
  const hits = await searchUnsplash(query);
  return NextResponse.json({ preview: hits });
}

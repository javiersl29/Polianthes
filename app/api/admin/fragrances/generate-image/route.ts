import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateImage, type ImageGenerationInput } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  prompt_override?: string;
  save?: boolean;
};

type FragranceRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  family: string | null;
  mood: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  image_url: string | null;
};

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.slug !== "string") {
    return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  }
  const save = body.save !== false;
  const r = await query<FragranceRow>(
    `SELECT id, slug, brand, name, family, mood, top_notes, heart_notes, base_notes, image_url
     FROM fragrance WHERE slug = $1 AND active = TRUE`,
    [body.slug]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  const row = r.rows[0];
  const input: ImageGenerationInput = {
    fragranceName: row.name,
    brand: row.brand,
    family: row.family,
    mood: row.mood,
    topNotes: row.top_notes ?? [],
    heartNotes: row.heart_notes ?? [],
    baseNotes: row.base_notes ?? [],
    promptOverride: body.prompt_override
  };
  let result;
  try {
    result = await generateImage(input);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error generando imagen" },
      { status: 500 }
    );
  }
  if (result.provider === "mock" || !result.url) {
    return NextResponse.json({
      ok: false,
      reason: "no_provider",
      message: "La API de imágenes no está configurada o devolvió vacío.",
      prompt: buildPromptForEcho(input)
    });
  }
  if (!save) {
    return NextResponse.json({
      ok: true,
      saved: false,
      url: result.url,
      model: result.model,
      prompt: buildPromptForEcho(input)
    });
  }
  try {
    const downloaded = await fetch(result.url);
    if (!downloaded.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar la imagen (${downloaded.status})` },
        { status: 502 }
      );
    }
    const arrayBuffer = await downloaded.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dir = path.join(process.cwd(), "public", "fragancias");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${row.slug}.jpg`);
    fs.writeFileSync(file, buffer);
    const publicUrl = `/fragancias/${row.slug}.jpg`;
    await query(`UPDATE fragrance SET image_url = $1 WHERE id = $2`, [publicUrl, row.id]);
    return NextResponse.json({ ok: true, saved: true, image_url: publicUrl, model: result.model });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error guardando imagen" },
      { status: 500 }
    );
  }
}

function buildPromptForEcho(input: ImageGenerationInput): string {
  return `[brand: ${input.brand}] [name: ${input.fragranceName}] [family: ${input.family ?? "n/d"}] [mood: ${input.mood ?? "n/d"}]`;
}

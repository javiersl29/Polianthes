import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  generateImage,
  getImageApiConfig,
  testImageConnection,
  getImageConfigDiagnostics,
  type ImageGenerationInput
} from "@/lib/ai-image";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  prompt_override?: string;
  save?: boolean;
  /** Forzar que se use la imagen de marca (ignorar override por fragancia) */
  force_brand_bottle?: boolean;
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
  image_data: string | null;
  image_url: string | null;
  original_image_data: string | null;
  original_image_url: string | null;
  original_image_source: string | null;
  use_brand_bottle_override: boolean;
};

type BrandBottleRow = { image_data: string | null; mime_type: string };

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const [diag, test] = await Promise.all([getImageConfigDiagnostics(), testImageConnection()]);
  const cfg = await getImageApiConfig();
  const bb = await query<{ image_data: string | null; filename: string | null; updated_at: string }>(
    `SELECT image_data, filename, updated_at FROM brand_bottle_image WHERE id = 1`
  );
  const bbRow = bb.rows[0];
  const hasSerpapi = Boolean(cfg?.serpapi_api_key);
  const bbSize = bbRow?.image_data
    ? Math.floor((bbRow.image_data.length * 3) / 4)
    : 0;
  return NextResponse.json({
    config: diag,
    test,
    provider: {
      current: cfg?.provider ?? (process.env.GEMINI_API_KEY ? "gemini" : "minimax"),
      model: cfg?.model ?? null,
      has_db_key: Boolean(cfg?.api_key),
      has_env_gemini: Boolean(process.env.GEMINI_API_KEY),
      has_env_minimax: Boolean(process.env.MINIMAX_API_KEY)
    },
    brand_bottle: {
      has_image: Boolean(bbRow?.image_data),
      filename: bbRow?.filename ?? null,
      size_bytes: bbSize,
      updated_at: bbRow?.updated_at ?? null
    },
    search: {
      has_serpapi_key: hasSerpapi,
      has_tavily: Boolean(process.env.TAVILY_API_KEY),
      has_serper: Boolean(process.env.SERPER_API_KEY),
      has_pexels: Boolean(process.env.PEXELS_API_KEY)
    }
  });
}

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
    `SELECT id, slug, brand, name, family, mood, top_notes, heart_notes, base_notes,
            image_data, image_url, original_image_data, original_image_url, original_image_source,
            use_brand_bottle_override
     FROM fragrance WHERE slug = $1 AND active = TRUE`,
    [body.slug]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  const row = r.rows[0];

  // cargar imagen de la botella de la marca
  const bbRes = await query<BrandBottleRow>(
    `SELECT image_data, mime_type FROM brand_bottle_image WHERE id = 1`
  );
  const brandBottleDataUrl = bbRes.rows[0]?.image_data ?? null;

  const useBrandBottle = body.force_brand_bottle || row.use_brand_bottle_override || true;
  const originalPerfumeDataUrl = row.original_image_data ?? null;

  const input: ImageGenerationInput = {
    fragranceName: row.name,
    brand: row.brand,
    family: row.family,
    mood: row.mood,
    topNotes: row.top_notes ?? [],
    heartNotes: row.heart_notes ?? [],
    baseNotes: row.base_notes ?? [],
    promptOverride: body.prompt_override,
    brandBottleDataUrl: useBrandBottle ? brandBottleDataUrl : null,
    originalPerfumeDataUrl
  };
  const result = await generateImage(input);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      reason: "generation_failed",
      message: result.error,
      model: result.model,
      endpoint: result.endpoint,
      used_brand_bottle: useBrandBottle,
      has_original_reference: Boolean(originalPerfumeDataUrl),
      debug: result.debug
    });
  }

  // Normalizar a base64: si vino URL, descargar y convertir; si vino b64, usar directo
  let finalDataUrl: string | null = null;
  if (result.b64) {
    const mt = result.mimeType || "image/jpeg";
    finalDataUrl = `data:${mt};base64,${result.b64}`;
  } else if (result.url) {
    try {
      const r2 = await fetch(result.url, { signal: AbortSignal.timeout(30000) });
      if (r2.ok) {
        const contentType = r2.headers.get("content-type") ?? "image/jpeg";
        const buf = Buffer.from(await r2.arrayBuffer());
        if (buf.length > 0 && buf.length < 10 * 1024 * 1024) {
          finalDataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!finalDataUrl) {
    return NextResponse.json({
      ok: false,
      reason: "no_data",
      message: "La API no devolvió imagen utilizable (ni base64 ni URL descargable)."
    });
  }

  if (!save) {
    // Preview: devolver data URL directamente (no persistir)
    return NextResponse.json({
      ok: true,
      saved: false,
      data_url: finalDataUrl,
      model: result.model,
      endpoint: result.endpoint,
      used_brand_bottle: useBrandBottle,
      has_original_reference: Boolean(originalPerfumeDataUrl)
    });
  }

  // Guardar en fragrance.image_data (base64) — sobrevive redeploys
  const publicPath = `/api/image/${row.slug}`;
  await query(
    `UPDATE fragrance SET image_data = $1, image_url = $2 WHERE id = $3`,
    [finalDataUrl, publicPath, row.id]
  );
  const sizeBytes = Math.floor((finalDataUrl.length * 3) / 4);
  return NextResponse.json({
    ok: true,
    saved: true,
    image_url: publicPath,
    size_bytes: sizeBytes,
    model: result.model,
    used_brand_bottle: useBrandBottle,
    has_original_reference: Boolean(originalPerfumeDataUrl)
  });
}

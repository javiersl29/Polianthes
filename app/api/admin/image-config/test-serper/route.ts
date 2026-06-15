import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getImageApiConfig } from "@/lib/ai-image";
import { findReferenceImage } from "@/lib/reference-image";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "raw";

  const cfg = await getImageApiConfig();
  const dbKey = (cfg as { serper_api_key?: string | null } | null)?.serper_api_key ?? null;
  const envKey = process.env.SERPER_API_KEY ?? null;
  const key = dbKey ?? envKey;
  const source = dbKey
    ? "db:image_api_config.serper_api_key"
    : envKey
    ? "env:SERPER_API_KEY"
    : null;

  if (!key) {
    return NextResponse.json({
      ok: false,
      error:
        "Sin Serper api_key. Agrégala en Configuración o define SERPER_API_KEY en Railway. Obtén una gratis en serper.dev (2,500 búsquedas/mes).",
      debug: { db_key_length: dbKey?.length ?? 0, env_key_length: envKey?.length ?? 0 }
    });
  }

  if (mode === "raw") {
    // Test raw: llama a Serper con la query especificada
    const q = url.searchParams.get("q") ?? "Chanel Coco Mademoiselle perfume bottle";
    const num = Number(url.searchParams.get("num") ?? "5");
    const start = Date.now();
    try {
      const res = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": key },
        body: JSON.stringify({ q, num: Math.max(1, Math.min(20, num)) }),
        signal: AbortSignal.timeout(20000)
      });
      const data = (await res.json()) as {
        images?: { imageUrl: string; source?: string; title?: string; imageWidth?: number; imageHeight?: number }[];
      };
      return NextResponse.json({
        ok: res.ok,
        source,
        elapsed_ms: Date.now() - start,
        image_count: data.images?.length ?? 0,
        first_image: data.images?.[0] ?? null,
        // Return all candidate URLs with title/source for debugging
        candidates: (data.images ?? []).map((i) => ({
          url: i.imageUrl,
          source: i.source,
          title: i.title,
          width: i.imageWidth,
          height: i.imageHeight
        })),
        statusCode: res.status
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        source,
        error: err instanceof Error ? err.message : "Error de red",
        elapsed_ms: Date.now() - start
      });
    }
  }

  if (mode === "cascade") {
    // Test de cascada real: simula el flow de findReferenceImage
    const brand = url.searchParams.get("brand") ?? "Dior";
    const name = url.searchParams.get("name") ?? "Miss Dior";
    const genderParam = url.searchParams.get("gender");
    const gender =
      genderParam === "hombre" || genderParam === "mujer" || genderParam === "unisex"
        ? (genderParam as "hombre" | "mujer" | "unisex")
        : null;
    const start = Date.now();
    const ref = await findReferenceImage(brand, name, null, 0, gender);
    return NextResponse.json({
      ok: !!ref,
      elapsed_ms: Date.now() - start,
      brand,
      name,
      reference: ref
        ? {
            url: ref.url.substring(0, 100),
            source: ref.source,
            title: ref.title
          }
        : null
    });
  }

  return NextResponse.json({ error: "mode debe ser 'raw' o 'cascade'" }, { status: 400 });
}

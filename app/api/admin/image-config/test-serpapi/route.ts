import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { searchSerpApiImages } from "@/lib/serpapi";
import { getImageApiConfig } from "@/lib/ai-image";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const cfg = await getImageApiConfig();
  // Trazos de diagnóstico: confirmar fuente y longitud real de la key
  const dbKeyLen = (cfg?.serpapi_api_key ?? "").length;
  const envKeyLen = (process.env.SERPAPI_API_KEY ?? "").length;
  const key = cfg?.serpapi_api_key ?? process.env.SERPAPI_API_KEY ?? null;
  const source = cfg?.serpapi_api_key
    ? "db:image_api_config.serpapi_api_key"
    : process.env.SERPAPI_API_KEY
    ? "env:SERPAPI_API_KEY"
    : null;
  if (!key) {
    return NextResponse.json({
      ok: false,
      error:
        "Sin SerpAPI api_key. Agrégala en la configuración (panel Configuración) o define SERPAPI_API_KEY en Railway.",
      debug: {
        db_key_length: dbKeyLen,
        env_key_length: envKeyLen,
        db_config_active: cfg?.active ?? null,
        db_config_id: cfg?.id ?? null
      }
    });
  }
  const start = Date.now();
  const r = await searchSerpApiImages("Chanel Coco Mademoiselle perfume bottle", key, 5);
  return NextResponse.json({
    ok: r.ok,
    source,
    db_key_length: dbKeyLen,
    env_key_length: envKeyLen,
    elapsed_ms: Date.now() - start,
    image_count: r.images.length,
    first_image: r.images[0]
      ? { url: r.images[0].url, width: r.images[0].width, height: r.images[0].height, source: r.images[0].source }
      : null,
    error: r.error,
    statusCode: r.statusCode
  });
}

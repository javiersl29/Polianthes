import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getImageApiConfig } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

/**
 * Test de conexión con Serper.dev. Hace una búsqueda real con la key
 * configurada (DB o ENV) y devuelve el resultado.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
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

  const start = Date.now();
  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": key },
      body: JSON.stringify({ q: "Chanel Coco Mademoiselle perfume bottle", num: 5 }),
      signal: AbortSignal.timeout(20000)
    });
    const data = (await res.json()) as {
      images?: { imageUrl: string; source?: string }[];
    };
    return NextResponse.json({
      ok: res.ok,
      source,
      db_key_length: dbKey?.length ?? 0,
      env_key_length: envKey?.length ?? 0,
      elapsed_ms: Date.now() - start,
      image_count: data.images?.length ?? 0,
      first_image: data.images?.[0]
        ? { url: data.images[0].imageUrl, source: data.images[0].source }
        : null,
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

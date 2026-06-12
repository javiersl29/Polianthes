import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { testGeminiConnection, resolveGeminiConfig } from "@/lib/gemini-image";
import { getImageApiConfig } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const cfg = await getImageApiConfig();
  const dbKey = cfg?.gemini_api_key ?? null;
  const envKey = process.env.GEMINI_API_KEY ?? null;
  const gcfg = resolveGeminiConfig({ api_key: dbKey, model: cfg?.model ?? null, aspect_ratio: cfg?.aspect_ratio ?? null });
  const start = Date.now();
  const r = await testGeminiConnection();
  return NextResponse.json({
    ok: r.ok,
    endpoint: r.endpoint,
    model: r.model,
    source: r.source,
    elapsed_ms: Date.now() - start,
    status_code: r.status_code,
    db_key_length: (dbKey ?? "").length,
    env_key_length: (envKey ?? "").length,
    resolved_config: gcfg
      ? { model: gcfg.model, aspect_ratio: gcfg.aspectRatio, image_size: gcfg.imageSize, thinking_level: gcfg.thinkingLevel }
      : null,
    error: r.error
  });
}

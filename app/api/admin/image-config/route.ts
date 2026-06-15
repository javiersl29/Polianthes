import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { getImageApiConfig } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const cfg = await getImageApiConfig();
  const envSerper = process.env.SERPER_API_KEY ?? null;
  const envZai = process.env.ZAI_API_KEY ?? null;
  const envMiniMax = process.env.MINIMAX_API_KEY ?? null;
  const envGemini = process.env.GEMINI_API_KEY ?? null;

  // Cada provider tiene su key separada
  const geminiSrc: "db" | "env" | "none" = cfg?.gemini_api_key
    ? "db"
    : envGemini
    ? "env"
    : "none";
  const minimaxSrc: "db" | "env" | "none" = cfg?.api_key
    ? "db"
    : envMiniMax
    ? "env"
    : "none";
  const serperSrc: "db" | "env" | "none" = (cfg as { serper_api_key?: string } | null)?.serper_api_key
    ? "db"
    : envSerper
    ? "env"
    : "none";
  const zaiSrc: "db" | "env" | "none" = (cfg as { zai_api_key?: string } | null)?.zai_api_key
    ? "db"
    : envZai
    ? "env"
    : "none";
  const preferredProvider = (cfg?.provider ?? (envGemini ? "gemini" : "minimax")) as string;
  const genSrc: "db" | "env" | "none" =
    preferredProvider === "gemini" ? geminiSrc : minimaxSrc;

  if (!cfg) {
    return NextResponse.json({
      config: null,
      sources: {
        serper: serperSrc,
        zai: zaiSrc,
        gen: genSrc,
        gemini: geminiSrc,
        minimax: minimaxSrc,
        env_serper_length: envSerper?.length ?? 0,
        env_zai_length: envZai?.length ?? 0,
        env_gemini_length: envGemini?.length ?? 0,
        env_minimax_length: envMiniMax?.length ?? 0,
        preferred_provider: preferredProvider
      }
    });
  }
  return NextResponse.json({
    config: {
      ...cfg,
      api_key:
        cfg.api_key
          ? maskKey(cfg.api_key)
          : envMiniMax
          ? `${maskKey(envMiniMax)} (env:MINIMAX_API_KEY)`
          : null,
      gemini_api_key:
        cfg.gemini_api_key
          ? maskKey(cfg.gemini_api_key)
          : envGemini
          ? `${maskKey(envGemini)} (env:GEMINI_API_KEY)`
          : null,
      serper_api_key: (cfg as { serper_api_key?: string | null }).serper_api_key
        ? maskKey((cfg as { serper_api_key?: string | null }).serper_api_key!)
        : envSerper
        ? `${maskKey(envSerper)} (env:SERPER_API_KEY)`
        : null,
      zai_api_key: (cfg as { zai_api_key?: string | null }).zai_api_key
        ? maskKey((cfg as { zai_api_key?: string | null }).zai_api_key!)
        : envZai
        ? `${maskKey(envZai)} (env:ZAI_API_KEY)`
        : null
    },
    sources: {
      serper: serperSrc,
      zai: zaiSrc,
      gen: genSrc,
      gemini: geminiSrc,
      minimax: minimaxSrc,
      env_serper_length: envSerper?.length ?? 0,
      env_zai_length: envZai?.length ?? 0,
      env_gemini_length: envGemini?.length ?? 0,
      env_minimax_length: envMiniMax?.length ?? 0,
      preferred_provider: preferredProvider
    }
  });
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    provider?: string;
    endpoint?: string;
    api_key?: string | null;
    clear_api_key?: boolean;
    gemini_api_key?: string | null;
    clear_gemini_api_key?: boolean;
    serper_api_key?: string | null;
    clear_serper_api_key?: boolean;
    zai_api_key?: string | null;
    clear_zai_api_key?: boolean;
    model?: string;
    aspect_ratio?: string;
    response_format?: "url" | "base64";
    prompt_optimizer?: boolean;
    n?: number;
    active?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const current = await getImageApiConfig();
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (body.provider) {
    fields.push(`provider = $${i++}`);
    params.push(body.provider);
  }
  if (body.endpoint) {
    fields.push(`endpoint = $${i++}`);
    params.push(body.endpoint);
  }
  if (body.clear_api_key) {
    fields.push(`api_key = $${i++}`);
    params.push(null);
  } else if (body.api_key && body.api_key.trim().length > 0) {
    fields.push(`api_key = $${i++}`);
    params.push(body.api_key.trim());
  }
  if (body.clear_gemini_api_key) {
    fields.push(`gemini_api_key = $${i++}`);
    params.push(null);
  } else if (body.gemini_api_key && body.gemini_api_key.trim().length > 0) {
    fields.push(`gemini_api_key = $${i++}`);
    params.push(body.gemini_api_key.trim());
  }
  if (body.clear_serper_api_key) {
    fields.push(`serper_api_key = $${i++}`);
    params.push(null);
  } else if (body.serper_api_key && body.serper_api_key.trim().length > 0) {
    fields.push(`serper_api_key = $${i++}`);
    params.push(body.serper_api_key.trim());
  }
  if (body.clear_zai_api_key) {
    fields.push(`zai_api_key = $${i++}`);
    params.push(null);
  } else if (body.zai_api_key && body.zai_api_key.trim().length > 0) {
    fields.push(`zai_api_key = $${i++}`);
    params.push(body.zai_api_key.trim());
  }
  if (body.model) {
    fields.push(`model = $${i++}`);
    params.push(body.model);
  }
  if (body.aspect_ratio) {
    if (!["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"].includes(body.aspect_ratio)) {
      return NextResponse.json({ error: "aspect_ratio inválido" }, { status: 400 });
    }
    fields.push(`aspect_ratio = $${i++}`);
    params.push(body.aspect_ratio);
  }
  if (body.response_format && (body.response_format === "url" || body.response_format === "base64")) {
    fields.push(`response_format = $${i++}`);
    params.push(body.response_format);
  }
  if (typeof body.prompt_optimizer === "boolean") {
    fields.push(`prompt_optimizer = $${i++}`);
    params.push(body.prompt_optimizer);
  }
  if (typeof body.n === "number") {
    if (body.n < 1 || body.n > 9) {
      return NextResponse.json({ error: "n debe estar entre 1 y 9" }, { status: 400 });
    }
    fields.push(`n = $${i++}`);
    params.push(Math.floor(body.n));
  }
  if (typeof body.active === "boolean") {
    fields.push(`active = $${i++}`);
    params.push(body.active);
  }

  fields.push(`updated_at = NOW()`);

  if (current) {
    params.push(1);
    await query(
      `UPDATE image_api_config SET ${fields.join(", ")} WHERE id = $${i}`,
      params
    );
  } else {
    await query(
      `INSERT INTO image_api_config (id, provider, endpoint, model, aspect_ratio, response_format, prompt_optimizer, n, active, updated_at)
       VALUES (1, 'minimax', 'https://api.minimax.io/v1/image_generation', 'image-01', '1:1', 'url', FALSE, 1, TRUE, NOW())`
    );
    if (fields.length > 0) {
      // re-apply fields
      params.push(1);
      await query(
        `UPDATE image_api_config SET ${fields.join(", ")} WHERE id = $${i}`,
        params
      );
    }
  }

  const updated = await getImageApiConfig();
  return NextResponse.json({
    ok: true,
    config: updated
      ? {
          ...updated,
          api_key: updated.api_key ? maskKey(updated.api_key) : null,
          serper_api_key: (updated as { serper_api_key?: string | null }).serper_api_key
            ? maskKey((updated as { serper_api_key?: string | null }).serper_api_key!)
            : null,
          zai_api_key: (updated as { zai_api_key?: string | null }).zai_api_key
            ? maskKey((updated as { zai_api_key?: string | null }).zai_api_key!)
            : null
        }
      : null
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

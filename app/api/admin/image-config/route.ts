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
  if (!cfg) {
    return NextResponse.json({ config: null });
  }
  return NextResponse.json({ config: { ...cfg, api_key: cfg.api_key ? maskKey(cfg.api_key) : null } });
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
    config: updated ? { ...updated, api_key: updated.api_key ? maskKey(updated.api_key) : null } : null
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

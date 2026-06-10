import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAiConfig, saveAiConfig } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const config = await getAiConfig();
  const safe = { ...config, api_key: config.api_key ? "***" : null };
  return NextResponse.json({ config: safe });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json()) as {
    base_url?: string;
    api_key?: string;
    model?: string;
    system_prompt?: string;
    temperature?: number;
  };
  const cleanApiKey = body.api_key && body.api_key !== "***" ? body.api_key : undefined;
  await saveAiConfig({
    base_url: body.base_url,
    api_key: cleanApiKey,
    model: body.model,
    system_prompt: body.system_prompt,
    temperature: body.temperature
  });
  return NextResponse.json({ ok: true });
}

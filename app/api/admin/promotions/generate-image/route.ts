import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_PROMPT = "Elegant promotional banner for a luxury perfume brand. Dark sophisticated background with golden accents, soft glow, three perfume bottles arranged artistically with golden bokeh particles, cinematic lighting, high-end advertising photography, 16:9 aspect ratio, professional color grading.";

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const customPrompt = String(body.prompt ?? "").trim();
  const type = String(body.type ?? "bundle");
  const badgeColor = String(body.badge_color ?? "gold");

  if (!title) return NextResponse.json({ error: "title es obligatorio" }, { status: 400 });

  // Construir prompt optimizado
  const basePrompt = customPrompt || DEFAULT_PROMPT;
  const typeHints: Record<string, string> = {
    "3x2": "Three luxury perfume bottles prominently displayed, large 3x2 promotional badge in elegant gold",
    "2x1": "Two perfume bottles, 2x1 promotional offer visible",
    "percent": "Premium perfume collection with elegant discount percentage displayed in gold typography",
    "fixed": "Luxury perfume bottles with fixed price savings highlighted",
    "bundle": "Curated set of perfume bottles arranged as an exclusive gift bundle with golden ribbon",
    "free_shipping": "Premium perfume with elegant shipping offer visualization"
  };
  const colorHints: Record<string, string> = {
    gold: "warm gold and amber tones",
    rose: "rose gold and pink tones",
    sky: "cool blue and silver tones",
    emerald: "deep emerald green and gold tones",
    violet: "deep violet and gold tones"
  };
  const hint = typeHints[type] || typeHints.bundle;
  const color = colorHints[badgeColor] || colorHints.gold;
  const finalPrompt = `${basePrompt} ${hint}. Color palette: ${color}. Title reference: ${title}. Cinematic, ultra-detailed, 4K.`;

  // Llamar Gemini con image generation
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      }),
      signal: AbortSignal.timeout(55000)
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Gemini ${res.status}: ${errText.slice(0, 300)}` }, { status: 500 });
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let b64: string | null = null;
    let mime = "image/png";
    for (const part of parts) {
      if (part.inlineData?.data) {
        b64 = part.inlineData.data;
        mime = part.inlineData.mimeType || "image/png";
        break;
      }
    }
    if (!b64) {
      return NextResponse.json({ error: "Gemini no devolvió imagen. Prompt: " + finalPrompt.slice(0, 200) }, { status: 500 });
    }

    // Guardar en DB como data URL (base64) — el componente lo sirve directo
    const dataUrl = `data:${mime};base64,${b64}`;

    // Si se pasó id, actualizar el registro
    if (body.id) {
      const id = Number(body.id);
      if (Number.isFinite(id)) {
        await query(
          `UPDATE promotion SET image_url = $1, image_prompt = $2, image_ai_generated = TRUE, updated_at = NOW() WHERE id = $3`,
          [dataUrl, finalPrompt, id]
        );
      }
    }

    return NextResponse.json({
      image_url: dataUrl,
      prompt: finalPrompt,
      bytes: b64.length
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error generando imagen" },
      { status: 500 }
    );
  }
}

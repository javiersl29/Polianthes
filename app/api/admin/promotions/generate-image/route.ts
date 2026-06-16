import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateGeminiImage, resolveGeminiConfig } from "@/lib/gemini-image";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_PROMPT =
  "Elegant promotional banner for a luxury perfume brand. Dark sophisticated background with golden accents, soft glow, perfume bottles arranged artistically with golden bokeh particles, cinematic lighting, high-end advertising photography.";

export async function POST(req: NextRequest) {
  if (!isAuthenticated())
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const customPrompt = String(body.prompt ?? "").trim();
  const type = String(body.type ?? "bundle");
  const badgeColor = String(body.badge_color ?? "gold");
  const refImage = String(body.reference_image ?? "").trim(); // data URL

  if (!title)
    return NextResponse.json({ error: "title es obligatorio" }, { status: 400 });

  // Resolver config de Gemini (DB o env)
  let dbCfg: { api_key: string | null; model: string | null; aspect_ratio: string | null } | null = null;
  try {
    const cfgRow = await query<{ api_key: string | null; model: string | null; aspect_ratio: string | null }>(
      `SELECT api_key, model, aspect_ratio FROM image_api_config WHERE id = 1`
    );
    dbCfg = cfgRow.rows[0] ?? null;
  } catch { /* tabla puede no existir, usar env */ }

  const cfg = resolveGeminiConfig(dbCfg);
  if (!cfg) {
    return NextResponse.json(
      { error: "No hay API key de Gemini configurada. Agrégala en Configuración → IA o como GEMINI_API_KEY en env." },
      { status: 500 }
    );
  }

  // Procesar imagen de referencia si viene
  const referenceImages: { mimeType: string; data: string }[] = [];
  if (refImage.startsWith("data:image/")) {
    const m = refImage.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (m) {
      referenceImages.push({ mimeType: m[1], data: m[2] });
    }
  }

  // Construir prompt
  const basePrompt = customPrompt || DEFAULT_PROMPT;
  const hasRef = referenceImages.length > 0;
  const typeHints: Record<string, string> = {
    "3x2": "Three luxury perfume bottles prominently displayed, large 3x2 promotional badge",
    "2x1": "Two perfume bottles, 2x1 promotional offer visible",
    percent: "Premium perfume collection with elegant discount percentage in gold typography",
    fixed: "Luxury perfume bottles with fixed price savings highlighted",
    bundle: "Curated set of perfume bottles arranged as an exclusive gift bundle with golden ribbon",
    free_shipping: "Premium perfume with elegant shipping box and golden accents",
  };
  const colorHints: Record<string, string> = {
    gold: "warm gold and amber tones",
    rose: "rose gold and pink tones",
    sky: "cool blue and silver tones",
    emerald: "deep emerald green and gold tones",
    violet: "deep violet and gold tones",
  };
  const hint = typeHints[type] || typeHints.bundle;
  const color = colorHints[badgeColor] || colorHints.gold;
  const refInstruction = hasRef
    ? "Use the provided reference image as the base composition. Transform it into a professional promotional banner keeping the same subject and style."
    : "";
  const finalPrompt = `${basePrompt} ${hint}. Color palette: ${color}. ${refInstruction} Title reference: "${title}". Cinematic, ultra-detailed, 4K, wide banner format.`;

  const result = await generateGeminiImage(
    {
      referenceImages,
      prompt: finalPrompt,
      aspectRatio: "16:9",
      imageSize: "1K",
      thinkingLevel: hasRef ? "high" : "minimal",
    },
    cfg
  );

  if (!result.ok || !result.imageBase64) {
    return NextResponse.json(
      { error: result.error ?? "Gemini no devolvió imagen" },
      { status: 500 }
    );
  }

  const mime = result.mimeType ?? "image/png";
  const dataUrl = `data:${mime};base64,${result.imageBase64}`;

  // Si se pasó id, guardar en el registro
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
    bytes: result.imageBase64.length,
    model: result.model,
    used_reference: hasRef,
  });
}

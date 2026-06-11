import { NextRequest, NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai-config";
import { listFragrances } from "@/lib/fragrances";
import { chatCompletion } from "@/lib/llm";
import { HEXAGON_SETS } from "@/lib/decoder";

export const dynamic = "force-dynamic";

type Gender = "hombre" | "mujer" | "unisex";
type Body = {
  set: "familias" | "mood";
  vector: Record<string, number>;
  gender?: Gender;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const set = HEXAGON_SETS[body.set];
  if (!set) return NextResponse.json({ error: "Set no válido" }, { status: 400 });
  const gender: Gender = body.gender === "hombre" || body.gender === "mujer" ? body.gender : "unisex";

  const config = await getAiConfig();
  if (!config.api_key) {
    return NextResponse.json(
      { error: "El decodificador aún no ha sido configurado por el administrador." },
      { status: 503 }
    );
  }

  const catalog = await listFragrances();
  if (catalog.length === 0) {
    return NextResponse.json({ error: "El catálogo está vacío." }, { status: 503 });
  }

  const vectorText = set.axes
    .map((a) => `- ${a.label} (${a.hint}): ${body.vector[a.id] ?? 50}/100`)
    .join("\n");
  const filtered = gender === "unisex" ? catalog : catalog.filter((f) => f.gender === gender || f.gender === "unisex");
  const catalogText = filtered
    .map((f) => `• ${f.brand} — ${f.name} (slug: ${f.slug})${f.family ? ` [familia: ${f.family}]` : ""}${f.mood ? ` [mood: ${f.mood}]` : ""} [género: ${f.gender}]`)
    .join("\n");

  const userPrompt = `Preferencia de género del cliente: ${gender}.${gender === "unisex" ? " (Considera tanto fragancias de hombre como de mujer; las unisex suelen ser la opción más flexible.)" : " Prioriza fragancias etiquetadas con este género; las unisex también son bienvenidas."}\n\nCatálogo disponible (${filtered.length} fragancias):\n${catalogText}\n\nVector de afinidad del cliente (${set.id}):\n${vectorText}\n\nDevuelve exactamente 5 recomendaciones priorizando las fragancias cuya familia, mood o género coincida mejor con el vector.`;

  const messages = [
    { role: "system" as const, content: config.system_prompt ?? "" },
    { role: "user" as const, content: userPrompt }
  ];

  try {
    const completion = await chatCompletion(config, messages);
    const text = completion.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const safe = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(safe) as { recommendations?: { slug: string; reason: string }[] };
    const slugs = (parsed.recommendations ?? []).map((r) => r.slug);
    const recommendations = slugs
      .map((slug) => {
        const item = catalog.find((c) => c.slug === slug);
        const reason = parsed.recommendations?.find((r) => r.slug === slug)?.reason ?? "";
        return item ? { ...item, reason } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 5);
    return NextResponse.json({ recommendations, model: completion.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

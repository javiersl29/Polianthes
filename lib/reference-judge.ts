/**
 * LLM-as-judge para elegir la mejor imagen de referencia entre varios
 * candidatos. Usa MiniMax (configurado en `ai_config`) por default.
 *
 * MiniMax analiza los metadatos textuales (título, source, dimensiones,
 * URL del host) y elige el candidato que con mayor probabilidad es la
 * mejor foto de producto: una botella visible de perfumería en una
 * tienda, vertical, alta resolución, sin logos ajenos.
 *
 * El LLM NO ve las imágenes reales (no es un modelo de visión). Lo que
 * hace es razonar sobre señales textuales muy discriminantes:
 * - Dominio del host (tienda real > blog > red social)
 * - Título (producto específico > genérico > lifestyle)
 * - Source (tienda conocida > minorista > agregador)
 * - Dimensiones (grande > pequeño, vertical > horizontal)
 * - URL que parece thumbnail vs imagen original
 */

import { chatCompletion, extractFirstJson } from "./llm";
import { getAiConfig } from "./ai-config";

export type CandidateImage = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  thumbnail?: string;
};

export type JudgeResult = {
  /** URL del candidato elegido */
  bestUrl: string;
  /** índice del candidato elegido (0-based) */
  index: number;
  /** razón textual de la elección (opcional) */
  reason?: string;
  /** modelo que se usó como juez */
  model?: string;
};

const JUDGE_SYSTEM = `Eres el curador visual de Polianthes, una perfumería mexicana. Tu trabajo es elegir LA MEJOR imagen de referencia para un perfume entre varios candidatos. Tu salida SIEMPRE debe ser un JSON estricto con este formato exacto: {"index":<número entero entre 0 y el total de candidatos - 1>,"reason":"una frase breve, máximo 15 palabras, explicando tu elección"}. Sin texto antes ni después del JSON, sin markdown.

Criterios (en orden de prioridad):
1. Host de tienda real conocido (sephora.com, ulta.com, fragrancenet.com, macys.com, amazon.com) es MUY deseable
2. Source/título que mencione el nombre del perfume o "bottle" o "fragrance" o tamaño en ml/oz
3. Imagen grande y vertical (aspect ratio > 0.5 y < 1.0)
4. URL que NO contenga "thumb" o "icon" o "logo" (indica que es la imagen real, no thumbnail)
5. Evitar: blogs de reseñas, sitios de lifestyle, agregadores genéricos, Wikipedia

Si ningún candidato es claramente bueno, elige el que tenga el dominio de tienda más conocido y la mayor resolución. Si todos son malos, elige el de mayor resolución igualmente.`;

export async function pickBestReference(
  brand: string,
  name: string,
  candidates: CandidateImage[]
): Promise<JudgeResult | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { bestUrl: candidates[0].url, index: 0, reason: "único candidato" };
  }

  let cfg: Awaited<ReturnType<typeof getAiConfig>>;
  try {
    cfg = await getAiConfig();
  } catch {
    return null;
  }
  if (!cfg.api_key) {
    return null; // sin LLM configurado, el caller hará fallback
  }

  // Construir tabla compacta de candidatos
  const table = candidates
    .map((c, i) => {
      const host = (() => {
        try {
          return new URL(c.url).hostname.replace(/^www\./, "");
        } catch {
          return "?";
        }
      })();
      const aspect =
        c.width && c.height ? (c.width / c.height).toFixed(2) : "?";
      return `[${i}] host=${host} | size=${c.width ?? "?"}x${c.height ?? "?"} | aspect=${aspect} | source=${(c.source ?? "?").slice(0, 30)} | title=${(c.title ?? "?").slice(0, 60)}`;
    })
    .join("\n");

  const userMessage = `Perfume: "${brand}" - "${name}"

Candidatos (${candidates.length}):
${table}

Responde SOLO con el JSON.`;

  try {
    const resp = await chatCompletion(cfg, [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: userMessage }
    ]);
    const json = extractFirstJson(resp.text);
    if (!json) return null;
    const parsed = JSON.parse(json) as { index?: number; reason?: string };
    const idx = Number(parsed.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) {
      return null;
    }
    return {
      bestUrl: candidates[idx].url,
      index: idx,
      reason: parsed.reason,
      model: resp.model
    };
  } catch {
    return null;
  }
}

import type { AiConfig } from "./ai-config";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResponse = {
  text: string;
  model: string;
  raw?: unknown;
};

export function resolveEndpoint(baseUrl: string | null | undefined): string {
  const fallback = "https://api.openai.com/v1";
  const url = (baseUrl ?? fallback).replace(/\/+$/, "");
  return `${url}/chat/completions`;
}

/**
 * Extrae el primer objeto JSON balanceado de un texto. Ignora bloques
 * <think>…</think>, fenced code blocks, prefacios y trailers. Soporta
 * llaves y corchetes anidados con strings escapadas.
 */
export function extractFirstJson(text: string): string | null {
  // Quita bloques <think>…</think> (modelos con razonamiento)
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Busca la primera apertura de objeto
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

export async function chatCompletion(
  config: Pick<AiConfig, "api_key" | "base_url" | "model" | "temperature">,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  if (!config.api_key) {
    throw new Error("Falta configurar la API key en el panel de super-usuario.");
  }
  const response = await fetch(resolveEndpoint(config.base_url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: 800,
      messages
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[]; model?: string };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, model: data.model ?? config.model, raw: data };
}

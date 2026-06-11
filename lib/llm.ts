import { AiConfig } from "./ai-config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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
      max_tokens: 500,
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

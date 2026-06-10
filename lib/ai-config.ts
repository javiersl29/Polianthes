import { query } from "./db";

export type AiConfig = {
  base_url: string | null;
  api_key: string | null;
  model: string;
  system_prompt: string | null;
  temperature: number;
};

type AiConfigRow = Omit<AiConfig, "temperature"> & { temperature: string | number };

function normalize(row: AiConfigRow): AiConfig {
  const t = typeof row.temperature === "string" ? Number(row.temperature) : row.temperature;
  return { ...row, temperature: Number.isFinite(t) ? t : 0.7 };
}

const DEFAULT_SYSTEM_PROMPT = `Eres el curador de Polianthes, una casa de perfumería de autor. Tu rol es recomendar 5 fragancias del catálogo entregado al cliente, según un vector de afinidad olfativa (0-100 por eje). Responde SIEMPRE en español, en JSON estricto con este formato: {"recommendations":[{"slug":"...","reason":"una frase breve, máximo 18 palabras, evocadora y segura."}]} . No agregues texto fuera del JSON.`;

export async function getAiConfig(): Promise<AiConfig> {
  const result = await query<AiConfigRow>(
    `SELECT base_url, api_key, model, system_prompt, temperature FROM ai_config WHERE id = 1`
  );
  if (result.rows.length === 0) {
    return {
      base_url: null,
      api_key: null,
      model: "gpt-4o-mini",
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: 0.7
    };
  }
  return normalize(result.rows[0]);
}

export async function saveAiConfig(input: Partial<AiConfig>): Promise<void> {
  const temperature = Number(input.temperature);
  await query(
    `INSERT INTO ai_config (id, base_url, api_key, model, system_prompt, temperature, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       base_url = COALESCE(EXCLUDED.base_url, ai_config.base_url),
       api_key = COALESCE(EXCLUDED.api_key, ai_config.api_key),
       model = EXCLUDED.model,
       system_prompt = COALESCE(EXCLUDED.system_prompt, ai_config.system_prompt),
       temperature = EXCLUDED.temperature,
       updated_at = NOW()`,
    [
      input.base_url ?? null,
      input.api_key ?? null,
      input.model ?? "gpt-4o-mini",
      input.system_prompt ?? null,
      Number.isFinite(temperature) ? temperature : 0.7
    ]
  );
}

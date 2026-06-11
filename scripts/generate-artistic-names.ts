import { getPool } from "../lib/db";
import { getAiConfig } from "../lib/ai-config";
import { chatCompletion } from "../lib/llm";

type FragranceRow = {
  id: number;
  brand: string;
  name: string;
  family: string | null;
  mood: string | null;
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  artistic_name: string | null;
};

const FORBIDDEN_PATTERNS = [
  /one million/i, /cloud/i, /god is a woman/i, /sweet like candy/i, /thank u next/i, /wanted by night/i,
  /king bharara/i, /greenwich village/i, /goddess/i, /her( |$)/i, /man in black/i, /fierce/i
];

function cleanName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  s = s.replace(/^Polianthes\s+/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function hasForbidden(s: string, originalName: string, brand: string): boolean {
  if (FORBIDDEN_PATTERNS.some((re) => re.test(s))) return true;
  if (s.toLowerCase().includes(originalName.toLowerCase())) return true;
  if (s.toLowerCase().includes(brand.toLowerCase())) return true;
  return false;
}

async function generateName(row: FragranceRow, model: string, apiKey: string, baseUrl: string | null, temperature: number, maxTokens: number): Promise<string | null> {
  const prompt = `Eres el curador de Polianthes, una casa mexicana de perfumería de autor que crea interpretaciones olfativas de fragancias clásicas.

Necesito un nombre artístico, corto y elegante en ESPAÑOL para nuestra versión de esta fragancia:

Inspiración original: "${row.brand} - ${row.name}"
Notas de salida: ${(row.top_notes ?? []).slice(0, 3).join(", ") || "n/d"}
Notas de corazón: ${(row.heart_notes ?? []).slice(0, 3).join(", ") || "n/d"}
Notas de fondo: ${(row.base_notes ?? []).slice(0, 3).join(", ") || "n/d"}
Familia olfativa: ${row.family ?? "n/d"}
Estado de ánimo: ${row.mood ?? "n/d"}
Descripción: ${row.description ?? "n/d"}

Reglas estrictas:
- El nombre NO puede incluir "${row.name}" ni "${row.brand}" ni variantes
- El nombre debe ser de 1 a 3 palabras
- Debe ser evocador, sofisticado, comercial
- En español o latinizable (admite acentos)
- Ejemplos del estilo: Étoile, Velours, Brume, Onde, Absolu, Sillage, Cálido, Aurora, Mirada, Silencio
- Sin comillas, sin prefijos, sin explicaciones
- Responde SOLO el nombre, en una línea`;

  try {
    const res = await chatCompletion(
      { api_key: apiKey, base_url: baseUrl, model, temperature },
      [
        { role: "system", content: "Eres un naming specialist. Respondes únicamente con el nombre, sin comillas ni prefijos." },
        { role: "user", content: prompt }
      ]
    );
    const candidate = cleanName(res.text.split("\n")[0] ?? "");
    if (!candidate || candidate.length < 2 || candidate.length > 40) return null;
    if (hasForbidden(candidate, row.name, row.brand)) return null;
    return `Polianthes ${candidate}`;
  } catch (err) {
    console.error(`[llm] error para id=${row.id} "${row.brand} - ${row.name}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function run(): Promise<void> {
  const pool = getPool();
  const cfg = await getAiConfig();
  if (!cfg.api_key) {
    console.error("[artistic-names] No hay API key configurada en ai_config. Configúrala primero en /admin/ai.");
    process.exit(1);
  }
  const maxTokens = Number(process.env.MAX_TOKENS ?? "60");
  const onlyMissing = process.env.ONLY_MISSING !== "0";
  const where = onlyMissing ? "WHERE artistic_name IS NULL" : "";

  const result = await pool.query<FragranceRow>(
    `SELECT id, brand, name, family, mood, description, top_notes, heart_notes, base_notes, artistic_name
     FROM fragrance WHERE active = TRUE ${where} ORDER BY id`
  );
  const rows = result.rows;
  console.log(`[artistic-names] Procesando ${rows.length} fragancias (modelo: ${cfg.model}, only_missing=${onlyMissing})`);

  let ok = 0;
  let fail = 0;
  const start = Date.now();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const name = await generateName(row, cfg.model, cfg.api_key, cfg.base_url, cfg.temperature, maxTokens);
    if (name) {
      await pool.query(`UPDATE fragrance SET artistic_name = $1 WHERE id = $2`, [name, row.id]);
      ok += 1;
      console.log(`[${i + 1}/${rows.length}] ✓ PLT-${String(row.id).padStart(3, "0")} → ${name}`);
    } else {
      fail += 1;
      console.log(`[${i + 1}/${rows.length}] ✗ PLT-${String(row.id).padStart(3, "0")} (${row.brand} - ${row.name}) — sin nombre válido`);
    }
    if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[artistic-names] Listo en ${elapsed}s — ${ok} nombres asignados, ${fail} pendientes (puedes re-correr el script)`);
  process.exit(0);
}

run().catch((err) => {
  console.error("[artistic-names] fatal:", err);
  process.exit(1);
});

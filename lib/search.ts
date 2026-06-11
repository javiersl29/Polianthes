type SearchHit = { title: string; url: string; content: string };

export type SearchProvider = "tavily" | "serper" | "none";

export type SearchResult = { provider: SearchProvider; hits: SearchHit[]; query: string };

const TAVILY_URL = "https://api.tavily.com/search";
const SERPER_URL = "https://google.serper.dev/search";

/**
 * Búsqueda web opcional. Devuelve resultados estructurados o un objeto vacío
 * si no hay API key configurada. La función nunca lanza: el caller decide si
 * continuar sin contexto.
 */
export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetch(TAVILY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: maxResults,
          search_depth: "advanced",
          include_answer: true,
          include_raw_content: false
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { title: string; url: string; content: string }[];
          answer?: string;
        };
        const hits: SearchHit[] = (data.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content
        }));
        if (data.answer) {
          hits.unshift({ title: "Resumen", url: "tavily://answer", content: data.answer });
        }
        return { provider: "tavily", hits, query };
      }
    } catch {
      /* ignore */
    }
  }
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    try {
      const res = await fetch(SERPER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
        body: JSON.stringify({ q: query, num: maxResults })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          organic?: { title: string; link: string; snippet: string }[];
        };
        const hits: SearchHit[] = (data.organic ?? []).map((r) => ({
          title: r.title,
          url: r.link,
          content: r.snippet
        }));
        return { provider: "serper", hits, query };
      }
    } catch {
      /* ignore */
    }
  }
  return { provider: "none", hits: [], query };
}

export function formatHitsForPrompt(result: SearchResult): string {
  if (result.hits.length === 0) return "";
  const lines = result.hits
    .slice(0, 5)
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.content.slice(0, 600)}`)
    .join("\n\n");
  return lines;
}

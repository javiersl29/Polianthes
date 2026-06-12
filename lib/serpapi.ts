/**
 * Integración con SerpAPI Google Images.
 * Devuelve una lista de imágenes candidatas del perfume original.
 * Docs: https://serpapi.com/search?engine=google_images
 */

export type SerpApiImage = {
  url: string;
  thumbnail?: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
};

export type SerpApiResult = {
  ok: boolean;
  source: "serpapi";
  query: string;
  images: SerpApiImage[];
  error?: string;
  statusCode?: number;
};

const SERPAPI_URL = "https://serpapi.com/search.json";

export async function searchSerpApiImages(
  query: string,
  apiKey: string,
  limit = 10
): Promise<SerpApiResult> {
  if (!apiKey) {
    return { ok: false, source: "serpapi", query, images: [], error: "Sin SerpAPI api_key" };
  }
  try {
    const url = new URL(SERPAPI_URL);
    url.searchParams.set("engine", "google_images");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("ijn", "0");
    url.searchParams.set("num", String(Math.max(1, Math.min(50, limit))));
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (Polianthes/1.0)" },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      return {
        ok: false,
        source: "serpapi",
        query,
        images: [],
        statusCode: res.status,
        error: `SerpAPI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
      };
    }
    const data = (await res.json()) as {
      images_results?: {
        original?: string;
        thumbnail?: string;
        title?: string;
        source?: string;
        original_width?: number;
        original_height?: number;
      }[];
      error?: string;
    };
    if (data.error) {
      return { ok: false, source: "serpapi", query, images: [], error: data.error };
    }
    const images: SerpApiImage[] = (data.images_results ?? [])
      .map((r) => ({
        url: r.original ?? "",
        thumbnail: r.thumbnail,
        title: r.title,
        source: r.source,
        width: r.original_width,
        height: r.original_height
      }))
      .filter((i) => i.url && /^https?:\/\//.test(i.url));
    return { ok: true, source: "serpapi", query, images };
  } catch (err) {
    return {
      ok: false,
      source: "serpapi",
      query,
      images: [],
      error: err instanceof Error ? err.message : "Error de red"
    };
  }
}

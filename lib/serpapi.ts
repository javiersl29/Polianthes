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

/**
 * Busca imágenes en SerpAPI Google Images con filtros optimizados para
 * obtener fotos de producto de perfumes de diseñador (botella visible,
 * presentación 80ml+, en sitios de tienda).
 *
 * Filtros aplicados:
 * - imgsz=l: solo imágenes grandes (botella con detalle visible)
 * - imgar=t: aspect ratio vertical (las botellas de perfume son altas)
 * - image_type=photo: solo fotos reales (no clipart, ilustraciones, etc.)
 * - tbs=itp:photo: refuerza el filtro de tipo
 * - gl=us + hl=en: índice y locale en inglés (más resultados de tiendas)
 * - tbs=ift:jpg: solo formato JPG (no WebP ni PNG vectorial)
 *
 * Si la query incluye palabras como "site:sephora.com" se usan como filtro
 * de dominio.
 */
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
    // Locale y dominio en inglés (mercado US, mayoría de productos de tienda)
    url.searchParams.set("gl", "us");
    url.searchParams.set("hl", "en");
    url.searchParams.set("google_domain", "google.com");
    // Filtros visuales
    url.searchParams.set("imgsz", "l"); // Large (>= 640x480)
    url.searchParams.set("imgar", "t"); // Tall/vertical (botellas)
    url.searchParams.set("image_type", "photo");
    // tbs combina filtros avanzados en un solo parámetro
    // itp:photo = image type photo
    // iar:t = aspect ratio tall
    // isz:l = image size large
    // ift:jpg = format jpg
    url.searchParams.set("tbs", "itp:photo,iar:t,isz:l,ift:jpg");
    // safe: active (filtro explícito por defecto)
    url.searchParams.set("safe", "active");

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
        source_logo?: string;
        link?: string;
        original_width?: number;
        original_height?: number;
        is_product?: boolean;
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
      // Solo URLs válidas
      .filter((i) => i.url && /^https?:\/\//.test(i.url))
      // Filtra imágenes demasiado pequeñas (botella no se vería con calidad)
      .filter((i) => {
        if (i.width && i.height) {
          // queremos al menos 600px en el lado menor
          return Math.min(i.width, i.height) >= 400;
        }
        return true; // si no hay dimensiones, dejamos pasar
      });
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

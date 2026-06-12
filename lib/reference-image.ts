import { searchSerpApiImages } from "./serpapi";

export type ReferenceImage = {
  url: string;
  source: "serpapi" | "tavily" | "serper_images" | "pexels" | "unsplash" | "fallback";
  thumbnail?: string;
  title?: string;
  width?: number;
  height?: number;
  image_data?: string;
};

type TavilyImageHit = { url: string; description?: string };
type SerperImageHit = { imageUrl: string; title?: string; source?: string; link?: string };

const PEXELS_BASE = "https://api.pexels.com/v1/search";
const TAVILY_URL = "https://api.tavily.com/search";
const SERPER_IMAGES_URL = "https://google.serper.dev/images";

/**
 * Valida que una imagen de resultado realmente corresponde al perfume
 * que estamos buscando. Revisa que el título y la fuente mencionen
 * AMBAS palabras (brand y name). Esto es crítico porque muchos nombres
 * de perfume son palabras comunes (Fierce, Cloud, Noir, etc.) y Google
 * puede devolver resultados de productos no relacionados.
 */
function matchesPerfume(
  img: { title?: string; source?: string },
  brand: string,
  name: string
): boolean {
  const haystack = `${img.title ?? ""} ${img.source ?? ""}`.toLowerCase();
  if (!haystack.trim()) return true; // si no hay metadata, no podemos validar
  const brandLc = brand.toLowerCase();
  const nameLc = name.toLowerCase();
  // Quitamos tokens de marca y nombre muy cortos (1-2 chars) y stopwords
  const stop = new Set(["de", "la", "el", "los", "las", "y", "of", "the", "a", "an", "&", "by", "for", "in", "on", "to"]);
  const tokens = (s: string) =>
    s
      .replace(/[""«»']/g, "")
      .split(/[\s,;:.()\[\]/\-_]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stop.has(t));
  const brandTokens = tokens(brandLc);
  const nameTokens = tokens(nameLc);
  // Si no pudimos tokenizar nada (nombre muy corto), aceptamos
  if (brandTokens.length === 0 && nameTokens.length === 0) return true;
  // Requerir al menos un token de brand Y un token de name
  const hasBrand = brandTokens.length === 0 || brandTokens.some((t) => haystack.includes(t));
  const hasName = nameTokens.length === 0 || nameTokens.some((t) => haystack.includes(t));
  return hasBrand && hasName;
}

async function fromSerpApi(brand: string, name: string, apiKey: string): Promise<ReferenceImage | null> {
  if (!apiKey) return null;

  // Limpieza y quoting estricto: cada token entre comillas para forzar
  // coincidencia exacta de la frase (evita que Google sugiera el "Fierce"
  // de Nike, etc.)
  const quote = (s: string) => `"${s.replace(/"/g, "")}"`;
  const b = quote(brand);
  const n = quote(name);
  // Negative keywords para descartar categorías que comparten nombres
  const neg = "-shoes -clothing -apparel -shirt -jacket -sneaker -t-shirt -poster -wallpaper -logo -svg";

  // Cascada de queries, cada una más específica que la anterior
  const queries = [
    // 1. Coincidencia exacta de la frase completa en tiendas reales
    `${b} ${n} 100ml site:sephora.com OR site:ulta.com OR site:fragrancenet.com OR site:macys.com OR site:amazon.com`,
    // 2. Mismo pero sin restricción de sitio, agregando negative keywords
    `${b} ${n} 100ml eau de parfum bottle ${neg}`,
    // 3. Con "buy" para priorizar listings de producto
    `${b} ${n} perfume buy ${neg}`,
    // 4. Versión 3.4oz (tamaño US 100ml)
    `${b} ${n} 3.4oz fragrance ${neg}`,
    // 5. Fallback genérico (último recurso, más ruidoso)
    `${b} ${n} eau de parfum bottle ${neg}`
  ];

  for (const q of queries) {
    const r = await searchSerpApiImages(q, apiKey, 15);
    if (!r.ok || r.images.length === 0) continue;

    // Validamos CADA imagen contra brand + name antes de devolver
    const candidates = r.images
      .filter((img) => matchesPerfume(img, brand, name))
      .filter((img) => {
        if (img.width && img.height) {
          const ratio = img.width / img.height;
          if (ratio < 0.3 || ratio > 3) return false;
          if (Math.max(img.width, img.height) < 600) return false;
        }
        return true;
      })
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

    if (candidates.length === 0) {
      // Esta query no produjo coincidencias; pasamos a la siguiente
      continue;
    }

    const best = candidates[0];
    return {
      url: best.url,
      thumbnail: best.thumbnail,
      source: "serpapi",
      title: best.title,
      width: best.width,
      height: best.height
    };
  }
  return null;
}

async function fromTavily(brand: string, name: string): Promise<ReferenceImage | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  // Query con comillas para frase exacta + tamaño grande
  const q = `"${brand}" "${name}" 100ml eau de parfum bottle`;
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: q,
        max_results: 8,
        search_depth: "advanced",
        include_images: true,
        include_answer: false,
        include_raw_content: false
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: TavilyImageHit[] };
    const imgs = data.images ?? [];
    // Tavily no devuelve title/source para validar; pedimos más y tomamos el
    // primero. Si quieres validación estricta, usa SerpAPI (que sí valida).
    for (const img of imgs) {
      if (img?.url && /^https?:\/\//.test(img.url)) {
        return { url: img.url, source: "tavily", thumbnail: img.url };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fromSerperImages(brand: string, name: string): Promise<ReferenceImage | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    // Query con comillas exactas
    const q = `"${brand}" "${name}" 100ml perfume bottle`;
    const res = await fetch(SERPER_IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": key },
      body: JSON.stringify({ q, num: 10 })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: SerperImageHit[] };
    for (const img of data.images ?? []) {
      if (img?.imageUrl && /^https?:\/\//.test(img.imageUrl)) {
        // Validación: title o link debe mencionar brand y name
        const haystack = `${img.title ?? ""} ${img.source ?? ""} ${img.link ?? ""}`.toLowerCase();
        if (haystack.trim()) {
          const brandOk = brand.toLowerCase().split(/\s+/).some((t) => t.length >= 3 && haystack.includes(t));
          const nameOk = name.toLowerCase().split(/\s+/).some((t) => t.length >= 3 && haystack.includes(t));
          if (!brandOk || !nameOk) continue;
        }
        return { url: img.imageUrl, source: "serper_images", thumbnail: img.imageUrl };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fromPexels(brand: string, name: string): Promise<ReferenceImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    // Pexels es búsqueda genérica de fotos, no por producto. Solo como
    // último recurso, sin validación.
    const query = `${brand} ${name} perfume bottle`;
    const res = await fetch(
      `${PEXELS_BASE}?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: { src?: { large?: string; medium?: string; original?: string; portrait?: string } }[];
    };
    for (const photo of data.photos ?? []) {
      const url = photo.src?.large ?? photo.src?.portrait ?? photo.src?.medium ?? photo.src?.original;
      if (url) return { url, source: "pexels" };
    }
    return null;
  } catch {
    return null;
  }
}

async function fromUnsplashFallback(query: string): Promise<ReferenceImage | null> {
  try {
    const res = await fetch(
      `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`,
      { method: "HEAD", redirect: "manual" }
    );
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) return { url: location, source: "unsplash" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca una imagen de referencia del perfume original.
 * Cascada: SerpAPI (si api_key provista) → Tavily → Serper Images → Pexels → Unsplash
 */
export async function findReferenceImage(
  brand: string,
  name: string,
  serpApiKey?: string | null
): Promise<ReferenceImage | null> {
  // 1) SerpAPI Google Images (preferido cuando hay api_key)
  if (serpApiKey) {
    const r = await fromSerpApi(brand, name, serpApiKey);
    if (r) return r;
  }

  // 2) Tavily: ya no necesita query, usa brand+name directamente
  const rTavily = await fromTavily(brand, name);
  if (rTavily) return rTavily;
  // 3) Serper Images
  const rSerper = await fromSerperImages(brand, name);
  if (rSerper) return rSerper;
  // 4) Pexels
  const rPexels = await fromPexels(brand, name);
  if (rPexels) return rPexels;
  // 5) Unsplash fallback
  const r = await fromUnsplashFallback(`${brand} ${name} perfume`);
  if (r) return r;
  return null;
}

/**
 * Descarga una imagen y la convierte a data URL base64.
 * Límite de seguridad: 10MB. Útil cuando se quiere persistir en DB.
 */
export async function fetchAsDataUrl(
  url: string,
  maxBytes = 10 * 1024 * 1024
): Promise<{ dataUrl: string; contentType: string; bytes: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Polianthes/1.0)" },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;
    return {
      dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
      contentType,
      bytes: buffer.length
    };
  } catch {
    return null;
  }
}

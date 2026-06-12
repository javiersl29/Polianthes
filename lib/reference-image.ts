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

async function fromSerpApi(brand: string, name: string, apiKey: string): Promise<ReferenceImage | null> {
  if (!apiKey) return null;
  const queries = [
    `${brand} ${name} perfume bottle`,
    `${brand} ${name} fragrance bottle`,
    `${brand} ${name} perfume`,
    `${name} perfume bottle ${brand}`,
    `${name} ${brand} parfum`
  ];
  for (const q of queries) {
    const r = await searchSerpApiImages(q, apiKey, 10);
    if (r.ok && r.images.length > 0) {
      // prefer images with reasonable aspect ratio (no logos, no huge bgs)
      const candidates = r.images
        .filter((img) => {
          if (img.width && img.height) {
            const ratio = img.width / img.height;
            if (ratio < 0.3 || ratio > 3) return false;
          }
          return true;
        })
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
      const best = candidates[0] ?? r.images[0];
      return {
        url: best.url,
        thumbnail: best.thumbnail,
        source: "serpapi",
        title: best.title,
        width: best.width,
        height: best.height
      };
    }
  }
  return null;
}

async function fromTavily(query: string): Promise<ReferenceImage | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: `${query} perfume bottle product photo`,
        max_results: 5,
        search_depth: "advanced",
        include_images: true,
        include_answer: false,
        include_raw_content: false
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: TavilyImageHit[] };
    const imgs = data.images ?? [];
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

async function fromSerperImages(query: string): Promise<ReferenceImage | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(SERPER_IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": key },
      body: JSON.stringify({ q: `${query} perfume bottle`, num: 5 })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: SerperImageHit[] };
    for (const img of data.images ?? []) {
      if (img?.imageUrl && /^https?:\/\//.test(img.imageUrl)) {
        return { url: img.imageUrl, source: "serper_images", thumbnail: img.imageUrl };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fromPexels(query: string): Promise<ReferenceImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
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

  const queries = [
    `${brand} ${name} perfume`,
    `${brand} ${name} fragrance bottle`,
    `${name} perfume bottle`,
    `${brand} perfume`
  ];

  // 2) Tavily
  for (const q of queries) {
    const r = await fromTavily(q);
    if (r) return r;
  }
  // 3) Serper Images
  for (const q of queries) {
    const r = await fromSerperImages(q);
    if (r) return r;
  }
  // 4) Pexels
  for (const q of queries) {
    const r = await fromPexels(`${q} bottle`);
    if (r) return r;
  }
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

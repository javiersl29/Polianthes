import { searchSerpApiImages, type SerpApiImage, type SerpApiResult } from "./serpapi";
import { pickBestReference } from "./reference-judge";

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

async function fromSerpApi(
  brand: string,
  name: string,
  apiKey: string,
  attempt = 0
): Promise<ReferenceImage | null> {
  if (!apiKey) return null;

  // Limpieza y quoting estricto: cada token entre comillas para forzar
  // coincidencia exacta de la frase (evita que Google sugiera el "Fierce"
  // de Nike, etc.)
  const quote = (s: string) => `"${s.replace(/"/g, "")}"`;
  const b = quote(brand);
  const n = quote(name);
  const neg = "-shoes -clothing -apparel -shirt -jacket -sneaker -t-shirt -poster -wallpaper -logo -svg";

  // Variamos queries según el intento (attempt) para que re-buscar no
  // devuelva la misma imagen siempre. Cada attempt usa una combinación
  // diferente de queries + páginas.
  const queryPool: { q: string; page: number }[] = [
    { q: `${b} ${n} 100ml site:sephora.com OR site:ulta.com OR site:fragrancenet.com OR site:macys.com OR site:amazon.com`, page: 0 },
    { q: `${b} ${n} 100ml eau de parfum bottle ${neg}`, page: 0 },
    { q: `${b} ${n} perfume buy ${neg}`, page: 0 },
    { q: `${b} ${n} 3.4oz fragrance ${neg}`, page: 0 },
    { q: `${b} ${n} eau de parfum bottle ${neg}`, page: 0 },
    { q: `${b} ${n} official fragrance`, page: 0 },
    { q: `${b} ${n} site:sephora.com OR site:ulta.com`, page: 1 },
    { q: `${b} ${n} 100ml perfume bottle ${neg}`, page: 1 }
  ];

  // Cada attempt usa un offset diferente en el pool para garantizar
  // variación entre llamadas
  const offset = (attempt * 3) % queryPool.length;
  const selected = [
    queryPool[offset % queryPool.length],
    queryPool[(offset + 1) % queryPool.length],
    queryPool[(offset + 2) % queryPool.length]
  ];

  // Recolectar candidatos únicos de múltiples queries
  const allCandidates: SerpApiImage[] = [];
  const seenUrls = new Set<string>();
  for (const { q, page } of selected) {
    const r = await searchSerpApiImagesWithPage(q, apiKey, 15, page);
    if (!r.ok || r.images.length === 0) continue;
    for (const img of r.images) {
      if (!img.url || seenUrls.has(img.url)) continue;
      if (!matchesPerfume(img, brand, name)) continue;
      // Validación de tamaño
      if (img.width && img.height) {
        const ratio = img.width / img.height;
        if (ratio < 0.3 || ratio > 3) continue;
        if (Math.max(img.width, img.height) < 600) continue;
      }
      seenUrls.add(img.url);
      allCandidates.push(img);
    }
  }
  if (allCandidates.length === 0) return null;

  // Si solo hay 1 candidato, lo devolvemos directo (no vale la pena
  // gastar tokens del LLM). Si hay 2+, usamos el LLM-as-judge.
  if (allCandidates.length === 1) {
    return { ...allCandidates[0], source: "serpapi" as const };
  }
  const topCandidates = allCandidates
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
    .slice(0, 6); // máximo 6 candidatos al LLM

  let chosenUrl: string | null = null;
  let judgeReason: string | undefined;
  try {
    const judge = await pickBestReference(brand, name, topCandidates);
    if (judge) {
      chosenUrl = judge.bestUrl;
      judgeReason = judge.reason;
    }
  } catch {
    /* LLM falló, fallback */
  }
  if (!chosenUrl) {
    // Fallback: el de mayor resolución
    const best = topCandidates[0];
    chosenUrl = best.url;
  }
  const best = allCandidates.find((c) => c.url === chosenUrl) ?? topCandidates[0];
  return {
    url: best.url,
    thumbnail: best.thumbnail,
    source: "serpapi",
    title: best.title ?? judgeReason,
    width: best.width,
    height: best.height
  };
}

/**
 * Variante de searchSerpApiImages que permite especificar el número
 * de página (ijn) para que re-buscar traiga imágenes diferentes.
 */
async function searchSerpApiImagesWithPage(
  query: string,
  apiKey: string,
  limit: number,
  page: number
): Promise<SerpApiResult> {
  // Construimos manualmente la URL para poder pasar ijn
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("ijn", String(page));
  url.searchParams.set("num", String(Math.max(1, Math.min(50, limit))));
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");
  url.searchParams.set("google_domain", "google.com");
  url.searchParams.set("imgsz", "l");
  url.searchParams.set("imgar", "t");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("tbs", "itp:photo,iar:t,isz:l,ift:jpg");
  url.searchParams.set("safe", "active");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
      },
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
  serpApiKey?: string | null,
  attempt = 0
): Promise<ReferenceImage | null> {
  // 1) SerpAPI Google Images (preferido cuando hay api_key)
  if (serpApiKey) {
    const r = await fromSerpApi(brand, name, serpApiKey, attempt);
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
 * Hosts conocidos que devuelven HTML/login/placeholder en vez de la imagen
 * real cuando se hotlinkean desde fuera. Descartamos URLs de estos hosts
 * para no terminar con referencias rotas.
 */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /(^|\.)instagram\.com$/i,
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)pinterest\.com$/i,
  /(^|\.)pinimg\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)tiktokcdn\.com$/i,
  /(^|\.)twimg\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)redd\.it$/i,
  /(^|\.)tumblr\.com$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)t\.co$/i,
  /(^|\.)bit\.ly$/i
];

/**
 * Detecta si una URL apunta a un host que probablemente bloquea hotlinking.
 */
export function isBlockedHost(url: string): boolean {
  try {
    const u = new URL(url);
    return BLOCKED_HOST_PATTERNS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Verifica que el buffer de bytes empieza con magic numbers válidos
 * de un formato de imagen real (JPEG, PNG, WebP, GIF).
 * Esto descarta respuestas que dicen ser imágenes pero en realidad
 * son HTML/JSON/placeholders de sitios que bloquean hotlinking.
 */
function isRealImageBuffer(buf: Buffer): { ok: boolean; mime: string | null } {
  if (buf.length < 12) return { ok: false, mime: null };
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, mime: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ok: true, mime: "image/png" };
  }
  // WebP: RIFF....WEBP (bytes 0-3 = "RIFF", 8-11 = "WEBP")
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ok: true, mime: "image/webp" };
  }
  // GIF: GIF87a or GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { ok: true, mime: "image/gif" };
  }
  return { ok: false, mime: null };
}

/**
 * Descarga una imagen y la convierte a data URL base64.
 * Límite de seguridad: 10MB. Útil cuando se quiere persistir en DB.
 * Filtra hosts bloqueados (Instagram, Pinterest, etc.) y valida los
 * magic bytes de la imagen real para descartar respuestas HTML/JSON
 * que algunos sitios devuelven en lugar de la imagen.
 */
export async function fetchAsDataUrl(
  url: string,
  maxBytes = 10 * 1024 * 1024
): Promise<{ dataUrl: string; contentType: string; bytes: number } | null> {
  if (isBlockedHost(url)) {
    return null;
  }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(30000),
      redirect: "follow"
    });
    if (!res.ok) return null;
    // Verificar longitud antes de descargar todo
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) return null;
    const contentType = res.headers.get("content-type") ?? "";
    // Solo aceptamos content-types de imagen
    if (!contentType.toLowerCase().startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;
    // Validar magic bytes: muchos sitios devuelven content-type: image/jpeg
    // pero el cuerpo es HTML o un placeholder. Los magic numbers no mienten.
    const check = isRealImageBuffer(buffer);
    if (!check.ok) return null;
    // Usar el mime type que detectamos por magic bytes (más confiable que el header)
    const finalMime = check.mime ?? contentType;
    return {
      dataUrl: `data:${finalMime};base64,${buffer.toString("base64")}`,
      contentType: finalMime,
      bytes: buffer.length
    };
  } catch {
    return null;
  }
}

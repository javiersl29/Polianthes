import { pickBestReference } from "./reference-judge";
import { getImageApiConfig } from "./ai-image";

export type ReferenceImage = {
  url: string;
  source: "serper_images" | "zai" | "fallback";
  thumbnail?: string;
  title?: string;
  width?: number;
  height?: number;
  image_data?: string;
};

type SerperImageHit = {
  imageUrl: string;
  title?: string;
  source?: string;
  link?: string;
  imageWidth?: number;
  imageHeight?: number;
};

const SERPER_IMAGES_URL = "https://google.serper.dev/images";
const ZAI_API_BASE = "https://api.z.ai/api";

/**
 * Hostnames de tiendas conocidas. Para estos, confiamos más en el dominio
 * que en el título (porque muchos listings de Amazon/Mercado Libre tienen
 * títulos genéricos tipo "Eau de Parfum Bottle 100ml" + sólo la URL tiene
 * el nombre real del perfume). Si el host es de confianza y la query ya
 * incluye brand+name entre comillas, la imagen es muy probablemente la
 * correcta.
 */
const TRUSTED_SHOP_HOSTS: RegExp[] = [
  // Marketplaces y tiendas departamentales
  /(^|\.)amazon\./i,
  /(^|\.)mercadolibre\.com\.mx$/i,
  /(^|\.)mercadolibre\.com$/i,
  /(^|\.)articulo\.mercadolibre\.com\.mx$/i,
  /(^|\.)sephora\./i,
  /(^|\.)ulta\.com$/i,
  /(^|\.)fragrancenet\.com$/i,
  /(^|\.)macys\.com$/i,
  /(^|\.)liverpool\.com\.mx$/i,
  /(^|\.)walmart\.com\.mx$/i,
  /(^|\.)walmart\.com$/i,
  /(^|\.)coppel\.com$/i,
  /(^|\.)ebay\.com$/i,
  // Sitios oficiales de marca (imágenes de producto de alta calidad)
  /(^|\.)dior\.com$/i,
  /(^|\.)chanel\.com$/i,
  /(^|\.)gucci\.com$/i,
  /(^|\.)ysl\.com$/i,
  /(^|\.)hermes\.com$/i,
  /(^|\.)lancome\.com$/i,
  /(^|\.)lancome-paris\./i,
  /(^|\.)tomford\.com$/i,
  /(^|\.)tomfordbeauty\.com$/i,
  /(^|\.)jo Malone\.|jomalone\.com/i,
  /(^|\.)guerlain\.com$/i,
  /(^|\.)dior\.com$/i,
  /(^|\.)mugler\.com$/i,
  /(^|\.)azzaro\.com$/i,
  /(^|\.)lancôme\./i,
  /(^|\.)jean-patugr|Com/i,
  /(^|\.)carolina-herrera\./i,
  /(^|\.)paco-rabanne\./i,
  // CDNs de marca
  /(^|\.)lancome-assets\./i,
  /(^|\.)dior-assets\./i,
  // Reviews / encyclopedia con fotos de producto de calidad
  /(^|\.)parfumo\.com$/i,
  /(^|\.)fragrantica\.com$/i,
  /(^|\.)basenotes\.com$/i,
  /(^|\.)fragrancevault\.net$/i
];

function isTrustedShopHost(url: string): boolean {
  try {
    const u = new URL(url);
    return TRUSTED_SHOP_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Valida que una imagen de resultado realmente corresponde al perfume
 * que estamos buscando. Versión más permisiva: para tiendas conocidas
 * (Amazon, Mercado Libre, etc.) confiamos en el dominio, y para otros
 * sitios pedimos match del nombre del perfume en el título.
 *
 * El brand es opcional (muchas imágenes de producto no mencionan la
 * marca en el title — la tienen en la URL o en la imagen misma). El
 * nombre del perfume sí lo requerimos, con match parcial: al menos
 * la mitad de los tokens significativos del name.
 */
function matchesPerfume(
  img: { title?: string; source?: string; url: string },
  brand: string,
  name: string
): boolean {
  // Tienda conocida (Amazon, Sephora, MercadoLibre, etc.) o sitio oficial
  // de marca (dior.com, chanel.com, etc.) → confiamos en el dominio. La
  // query ya tiene comillas exactas con brand+name, Google no devuelve
  // perfumes no relacionados en estas URLs.
  if (isTrustedShopHost(img.url)) return true;

  const haystack = `${img.title ?? ""} ${img.source ?? ""}`.toLowerCase();
  if (!haystack.trim()) return true; // sin metadata, no podemos validar

  const nameLc = name.toLowerCase();
  const brandLc = brand.toLowerCase();
  const stop = new Set([
    "de", "la", "el", "los", "las", "y", "of", "the", "a", "an", "&", "by",
    "for", "in", "on", "to", "with", "edt", "edp", "parfum", "toilette",
    "perfume", "fragrance", "bottle", "spray", "cologne", "new", "ml", "oz"
  ]);
  const tokens = (s: string) =>
    s
      .replace(/[""«»']/g, "")
      .split(/[\s,;:.()\[\]/\-_]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stop.has(t));
  const brandTokens = tokens(brandLc);
  const nameTokens = tokens(nameLc);

  // Si no hay tokens significativos del name, aceptamos
  if (nameTokens.length === 0) return true;

  // Match parcial: al menos 50% de los tokens del name deben aparecer
  const matched = nameTokens.filter((t) => haystack.includes(t)).length;
  if (matched / nameTokens.length >= 0.5) return true;

  // Si no, intentamos también con el brand como match secundario
  if (brandTokens.length > 0) {
    const brandMatched = brandTokens.filter((t) => haystack.includes(t)).length;
    if (brandMatched / brandTokens.length >= 0.5) return true;
  }

  return false;
}

async function fromSerperImages(
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
  // diferente de queries. Priorizamos marketplaces y tiendas con fotos
  // de producto de alta calidad.
  //
  // Tienda ranking (mejor -> peor para calidad de foto de producto):
  //  1. Amazon (amazon.com / amazon.com.mx) — fotos de listing profesionales
  //  2. Mercado Libre (mercadolibre.com.mx) — fotos de listing de vendedores
  //  3. Sephora / Ulta / FragranceNet / Macy's — fotos oficiales de marca
  //  4. Liverpool / Walmart / Coppel — tiendas departamentales mexicanas
  //  5. Ebay — listings variados (a veces muy buena calidad)
  //
  // Queries cortas (max ~50 chars) — Google devuelve más resultados.
  const queryPool: string[] = [
    // 1. Amazon prioritario (mejor calidad de listing, más resultados)
    `${b} ${n} 100ml site:amazon.com`,
    // 2. Mercado Libre (excelente para perfumes vendidos en Latam)
    `${b} ${n} 100ml site:mercadolibre.com.mx`,
    // 3. Amazon.com.mx
    `${b} ${n} 100ml site:amazon.com.mx`,
    // 4. Sephora / Ulta / FragranceNet (marcas oficiales)
    `${b} ${n} site:sephora.com OR site:ulta.com OR site:fragrancenet.com`,
    // 5. Tiendas departamentales mexicanas
    `${b} ${n} site:liverpool.com.mx OR site:walmart.com.mx`,
    // 6. Ebay (listings variados)
    `${b} ${n} 100ml site:ebay.com`,
    // 7. Genérica con tamaño
    `${b} ${n} 100ml eau de parfum bottle ${neg}`,
    // 8. Tamaño US 100ml
    `${b} ${n} 3.4oz fragrance ${neg}`,
    // 9. Fallback genérico (sin tamaño)
    `${b} ${n} perfume bottle ${neg}`,
    // 10. Con "buy" prioriza listings
    `${b} ${n} perfume buy ${neg}`,
    // 11. Oficial
    `${b} ${n} official fragrance bottle`,
    // 12. Walmart US
    `${b} ${n} 100ml site:walmart.com`
  ];

  // Cada attempt usa un offset diferente en el pool para garantizar
  // variación entre llamadas. Usamos 4 queries por attempt (en lugar
  // de 3) para compensar el bug de Serper que devuelve 0 con num=10+
  // y operador site:.
  const offset = (attempt * 4) % queryPool.length;
  const selected = [
    queryPool[offset % queryPool.length],
    queryPool[(offset + 1) % queryPool.length],
    queryPool[(offset + 2) % queryPool.length],
    queryPool[(offset + 3) % queryPool.length]
  ];

  // Recolectar candidatos únicos de múltiples queries. Filtros más
  // permisivos para no descartar imágenes legítimas de tamaño medio.
  const allCandidates: SerperImageHit[] = [];
  const seenUrls = new Set<string>();
  for (const q of selected) {
    // num=5-7 es el sweet spot de Serper. num=10+ con site: a veces
    // devuelve 0 imagenes (bug de Serper con operadores site: en
    // peticiones grandes). Cada query es una llamada separada.
    const r = await searchSerperImagesWithQuery(q, apiKey, 7);
    if (!r.ok || r.images.length === 0) continue;
    for (const img of r.images) {
      if (!img.imageUrl || seenUrls.has(img.imageUrl)) continue;
      const matchResult = matchesPerfume({ title: img.title, source: img.source, url: img.imageUrl }, brand, name);
      if (!matchResult) continue;
      // Validación de tamaño más permisiva: ≥400px lado mayor, ratio
      // 0.4-2.5 (incluye botellas verticales y cuadradas, excluye
      // banners y logos)
      if (img.imageWidth && img.imageHeight) {
        const ratio = img.imageWidth / img.imageHeight;
        if (ratio < 0.4 || ratio > 2.5) continue;
        if (Math.max(img.imageWidth, img.imageHeight) < 400) continue;
      }
      seenUrls.add(img.imageUrl);
      allCandidates.push(img);
    }
  }
  if (allCandidates.length === 0) return null;

  // Si solo hay 1 candidato, lo devolvemos directo (no vale la pena
  // gastar tokens del LLM). Si hay 2+, usamos el LLM-as-judge.
  if (allCandidates.length === 1) {
    const only = allCandidates[0];
    return {
      url: only.imageUrl,
      source: "serper_images" as const,
      thumbnail: only.imageUrl,
      title: only.title,
      width: only.imageWidth,
      height: only.imageHeight
    };
  }
  const topCandidates = allCandidates
    .sort((a, b) => (b.imageWidth ?? 0) - (a.imageWidth ?? 0))
    .slice(0, 6); // máximo 6 candidatos al LLM

  // Adaptamos al shape que espera pickBestReference
  const forJudge = topCandidates.map((c) => ({
    url: c.imageUrl,
    thumbnail: c.imageUrl,
    title: c.title,
    width: c.imageWidth,
    height: c.imageHeight
  }));

  let chosenUrl: string | null = null;
  let judgeReason: string | undefined;
  try {
    const judge = await pickBestReference(brand, name, forJudge);
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
    chosenUrl = best.imageUrl;
  }
  const best = allCandidates.find((c) => c.imageUrl === chosenUrl) ?? topCandidates[0];
  return {
    url: best.imageUrl,
    thumbnail: best.imageUrl,
    source: "serper_images",
    title: best.title ?? judgeReason,
    width: best.imageWidth,
    height: best.imageHeight
  };
}

/**
 * Llama al endpoint /images de Serper (Google Images vía Serper.dev).
 * Devuelve hasta `limit` resultados. Tier free: 2,500/mes.
 */
async function searchSerperImagesWithQuery(
  query: string,
  apiKey: string,
  limit: number
): Promise<{ ok: boolean; images: SerperImageHit[]; error?: string; statusCode?: number }> {
  try {
    const res = await fetch(SERPER_IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, num: Math.max(1, Math.min(100, limit)) }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      return {
        ok: false,
        images: [],
        statusCode: res.status,
        error: `Serper HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
      };
    }
    const data = (await res.json()) as { images?: SerperImageHit[] };
    return { ok: true, images: data.images ?? [] };
  } catch (err) {
    return {
      ok: false,
      images: [],
      error: err instanceof Error ? err.message : "Error de red"
    };
  }
}

/**
 * Z.AI image search: combina webSearchPrime (devuelve URLs de sitios)
 * + webReader (extrae imágenes reales de producto de esas URLs).
 *
 * Funciona especialmente bien con Sephora, Ulta, FragranceNet, Parfumo
 * (que no bloquean webReader). Amazon bloquea webReader, pero la búsqueda
 * de webSearchPrime también devuelve sitios oficiales y reseñas que sí
 * tienen imágenes.
 *
 * Requiere ZAI_API_KEY en env (o el default configurado en opencode).
 * Tier: depende del plan Z.AI activo.
 */
async function fromZaiImages(brand: string, name: string, apiKey: string, attempt = 0): Promise<ReferenceImage | null> {
  if (!apiKey) return null;

  const quote = (s: string) => `"${s.replace(/"/g, "")}"`;
  const b = quote(brand);
  const n = quote(name);

  // Queries optimizadas para sitios que sí funcionan con webReader
  const queryPool: string[] = [
    `${b} ${n} 100ml site:sephora.com OR site:ulta.com`,
    `${b} ${n} 100ml site:fragrancenet.com OR site:parfumo.com`,
    `${b} ${n} 100ml bottle official`,
    `${b} ${n} perfume review`
  ];
  const offset = attempt % queryPool.length;
  const query = queryPool[offset];

  // 1) webSearchPrime devuelve URLs
  const searchResults = await zaiWebSearch(query, apiKey);
  if (searchResults.length === 0) return null;

  // 2) Para cada URL, extraemos imágenes con webReader
  // Solo las top 4 URLs (límite práctico para evitar latencia)
  const topUrls = searchResults.slice(0, 4);
  const allImages: { url: string; sourceUrl: string; width?: number; height?: number; title?: string }[] = [];
  const seen = new Set<string>();

  for (const { url, title } of topUrls) {
    if (!/^https?:\/\//.test(url)) continue;
    if (isBlockedHost(url)) continue;
    const images = await zaiWebReader(url, apiKey);
    for (const img of images) {
      if (!img || seen.has(img)) continue;
      seen.add(img);
      allImages.push({ url: img, sourceUrl: url, title });
      if (allImages.length >= 12) break; // suficiente para juez
    }
    if (allImages.length >= 12) break;
  }
  if (allImages.length === 0) return null;

  // Filtros: descartar imágenes obviamente decorativas
  const candidates = allImages.filter((c) => {
    const lower = c.url.toLowerCase();
    // Patrones típicamente de producto (Sephora, Ulta, Parfumo)
    if (lower.includes("productimages/sku/")) return true;
    if (lower.includes("/media/") && lower.includes(".jpg")) return true;
    if (lower.includes("/images/") && lower.match(/\.(jpg|jpeg|webp|png)(\?|$)/i)) return true;
    // Descartar UI
    if (lower.includes("logo") || lower.includes("sprite") || lower.includes("icon")) return false;
    if (lower.includes("placeholder") || lower.includes("transparent")) return false;
    if (lower.includes("avatar") || lower.includes("thumb") && !lower.match(/s\d+x\d+/)) return false;
    return true;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { url: candidates[0].url, source: "zai", thumbnail: candidates[0].url, title: candidates[0].title };
  }

  // Si hay varias, devolvemos la primera con source: zai. El LLM-as-judge
  // no es necesario aquí porque las URLs de productimages/sku/ son
  // muy probablemente la botella correcta.
  return {
    url: candidates[0].url,
    source: "zai",
    thumbnail: candidates[0].url,
    title: candidates[0].title ?? candidates[0].sourceUrl
  };
}

/**
 * Llama al MCP webSearchPrime de Z.AI vía HTTP.
 * Devuelve hasta 10 resultados con title + url.
 */
async function zaiWebSearch(query: string, apiKey: string): Promise<{ title: string; url: string }[]> {
  try {
    const res = await fetch(`${ZAI_API_BASE}/mcp/web_search_prime/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "webSearchPrime",
          arguments: {
            search_query: query,
            count: 10
          }
        }
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseZaiSearchResponse(text);
  } catch {
    return [];
  }
}

/**
 * Llama al MCP webReader de Z.AI para extraer imágenes de una URL.
 */
async function zaiWebReader(url: string, apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`${ZAI_API_BASE}/mcp/web_reader/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "webReader",
          arguments: {
            url,
            return_format: "markdown",
            retain_images: true
          }
        }
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseZaiReaderImages(text);
  } catch {
    return [];
  }
}

/**
 * Parsea la respuesta SSE/JSON de webSearchPrime y extrae título + URL.
 * Z.AI MCP responde con formato JSON-RPC 2.0 envuelto en SSE.
 */
function parseZaiSearchResponse(raw: string): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  // SSE format: data: {json}\n\n
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const json = trimmed.slice(5).trim();
    if (!json || json === "[DONE]") continue;
    try {
      const parsed = JSON.parse(json) as {
        result?: {
          content?: { type: string; text?: string }[];
        };
      };
      const content = parsed.result?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c.type === "text" && c.text) {
          // El texto es un JSON stringify del array de resultados
          try {
            const arr = JSON.parse(c.text) as Array<{
              title?: string;
              link?: string;
              url?: string;
            }>;
            for (const r of arr) {
              const u = r.link ?? r.url;
              if (u && /^https?:\/\//.test(u)) {
                results.push({ title: r.title ?? "", url: u });
              }
            }
          } catch {
            // Si no es JSON, intentar regex sobre el texto
            const links = c.text.matchAll(/https?:\/\/[^\s"<>]+/g);
            for (const m of links) {
              results.push({ title: "", url: m[0] });
            }
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return results.slice(0, 10);
}

/**
 * Parsea la respuesta de webReader y extrae URLs de imágenes del markdown.
 * Formato esperado: ![alt](https://...)
 */
function parseZaiReaderImages(raw: string): string[] {
  const images: string[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const json = trimmed.slice(5).trim();
    if (!json || json === "[DONE]") continue;
    try {
      const parsed = JSON.parse(json) as {
        result?: {
          content?: { type: string; text?: string }[];
        };
      };
      const content = parsed.result?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c.type === "text" && c.text) {
          // Extraer ![alt](url) del markdown
          const mdImgs = c.text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g);
          for (const m of mdImgs) {
            images.push(m[2]);
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return images;
}

/**
 * Busca una imagen de referencia del perfume original.
 * Cascada simplificada: Serper (free 2.5K/mes) → Z.AI (plan activo).
 *
 * Las keys se leen de la DB (image_api_config) con fallback a env vars.
 *
 * @param _serpApiKey param legacy ignorado (se mantiene la firma por
 *                   compatibilidad con el resto del código)
 */
export async function findReferenceImage(
  brand: string,
  name: string,
  _serpApiKey?: string | null,
  attempt = 0
): Promise<ReferenceImage | null> {
  // Leemos la config de DB una sola vez. La cascada solo necesita serper
  // y zai; la demás config (provider de generación, MiniMax, etc.) se
  // ignora aquí.
  const cfg = await getImageApiConfig();
  const serperKey =
    (cfg as { serper_api_key?: string | null } | null)?.serper_api_key ??
    process.env.SERPER_API_KEY ??
    null;
  const zaiKey =
    (cfg as { zai_api_key?: string | null } | null)?.zai_api_key ??
    process.env.ZAI_API_KEY ??
    null;

  // 1) Serper Images (free 2,500/mes sin tarjeta, multi-attempt optimizado)
  if (serperKey) {
    const r = await fromSerperImages(brand, name, serperKey, attempt);
    if (r) return r;
  }

  // 2) Z.AI (complemento, plan activo) — usa webSearchPrime + webReader
  if (zaiKey) {
    const rZai = await fromZaiImages(brand, name, zaiKey, attempt);
    if (rZai) return rZai;
  }

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

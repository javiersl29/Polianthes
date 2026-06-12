import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  findReferenceImage,
  fetchAsDataUrl,
  isBlockedHost
} from "@/lib/reference-image";
import { getImageApiConfig } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  /** opcional: si true, también descarga y guarda base64 en fragrance.original_image_data */
  persist?: boolean;
};

type FragranceRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  original_image_data: string | null;
  original_image_url: string | null;
  original_image_source: string | null;
};

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.slug !== "string") {
    return NextResponse.json({ error: "slug requerido" }, { status: 400 });
  }
  const persist = body.persist !== false;

  const r = await query<FragranceRow>(
    `SELECT id, slug, brand, name, original_image_data, original_image_url, original_image_source
     FROM fragrance WHERE slug = $1`,
    [body.slug]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "Fragancia no encontrada" }, { status: 404 });
  }
  const row = r.rows[0];

  const cfg = await getImageApiConfig();
  const serpApiKey = cfg?.serpapi_api_key ?? process.env.SERPAPI_API_KEY ?? null;

  // Hacemos hasta 3 intentos de búsqueda (cada vez con queries diferentes)
  // hasta encontrar una imagen que NO esté en host bloqueado Y que
  // se pueda descargar y validar como imagen real.
  let ref = null;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await findReferenceImage(row.brand, row.name, serpApiKey);
    if (!candidate) {
      lastError = "no_results";
      break;
    }
    if (isBlockedHost(candidate.url)) {
      lastError = `blocked_host:${new URL(candidate.url).hostname}`;
      continue; // probar siguiente candidato
    }
    // Si no se va a persistir, devolvemos el primer candidato no bloqueado
    if (!persist) {
      ref = candidate;
      break;
    }
    // Si se va a persistir, validar que la imagen realmente se puede
    // descargar como imagen (no HTML de login/placeholder)
    const fetched = await fetchAsDataUrl(candidate.url);
    if (fetched) {
      ref = candidate;
      break;
    }
    lastError = `fetch_failed:${new URL(candidate.url).hostname}`;
  }
  if (!ref) {
    return NextResponse.json({
      ok: false,
      reason: "no_reference_found",
      message: `No se encontró imagen de referencia válida para "${row.brand} ${row.name}"${lastError ? ` (${lastError})` : ""}`,
      provider: serpApiKey ? "serpapi" : "tavily+fallback"
    });
  }

  let persistedDataUrl: string | null = null;
  let bytes: number | null = null;
  if (persist) {
    const fetched = await fetchAsDataUrl(ref.url);
    if (fetched) {
      persistedDataUrl = fetched.dataUrl;
      bytes = fetched.bytes;
      await query(
        `UPDATE fragrance
         SET original_image_data = $1,
             original_image_url = $2,
             original_image_source = $3,
             original_image_fetched_at = NOW()
         WHERE id = $4`,
        [fetched.dataUrl, ref.url, ref.source, row.id]
      );
    } else {
      // No se pudo descargar (sitio bloquea hotlinking). Guardamos solo
      // la URL como referencia informativa, sin data. El usuario verá
      // el link externo pero no la imagen embebida.
      await query(
        `UPDATE fragrance
         SET original_image_url = $1,
             original_image_source = $2,
             original_image_fetched_at = NOW()
         WHERE id = $3`,
        [ref.url, ref.source, row.id]
      );
    }
  }

  return NextResponse.json({
    ok: true,
    slug: row.slug,
    reference: {
      url: ref.url,
      source: ref.source,
      title: ref.title,
      thumbnail: ref.thumbnail,
      width: ref.width,
      height: ref.height
    },
    persisted: Boolean(persistedDataUrl),
    bytes,
    used_serpapi: Boolean(serpApiKey),
    blocked_attempts: lastError?.startsWith("blocked_host") ? 1 : 0
  });
}

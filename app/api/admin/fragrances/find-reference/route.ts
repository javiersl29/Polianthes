import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  findReferenceImage,
  fetchAsDataUrl,
  isBlockedHost
} from "@/lib/reference-image";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  /** opcional: si true, también descarga y guarda base64 en fragrance.original_image_data */
  persist?: boolean;
  /**
   * Contador de re-búsqueda del cliente. Cada click de "Re-buscar"
   * incrementa este valor para forzar queries/páginas DIFERENTES
   * (de lo contrario siempre devolvería la misma primera imagen).
   */
  refetch_count?: number;
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

  const serperKey = process.env.SERPER_API_KEY ?? null;
  const zaiKey = process.env.ZAI_API_KEY ?? null;

  // Hacemos hasta 3 intentos de búsqueda con queries DIFERENTES
  // para garantizar variación entre llamadas. Cada intento pasa un
  // "attempt" que cambia el offset en el pool de queries y hace que
  // fromSerperImages recolecte candidatos diferentes. El LLM-as-judge
  // selecciona el mejor de los candidatos recolectados.
  const baseAttempt = Number(body.refetch_count ?? 0) * 3;
  let ref = null;
  let lastError: string | null = null;
  for (let offset = 0; offset < 3; offset += 1) {
    const attempt = baseAttempt + offset;
    const candidate = await findReferenceImage(row.brand, row.name, null, attempt);
    if (!candidate) {
      lastError = "no_results";
      continue;
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
      provider: serperKey ? "serper" : zaiKey ? "zai" : "ninguno"
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
    used_serper: Boolean(serperKey),
    used_zai: Boolean(zaiKey),
    blocked_attempts: lastError?.startsWith("blocked_host") ? 1 : 0
  });
}

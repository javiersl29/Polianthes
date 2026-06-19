import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import PromoPackage from "./PromoPackage";
import PromoDiscount from "./PromoDiscount";

export const dynamic = "force-dynamic";

const SITE_URL = "https://polianthes.shop";

type Props = { params: { slug: string } };

type Promotion = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  value: number;
  bundle_price_cents: number;
  required_size_ml: number;
  mix_sizes: boolean;
  mix_config: Array<{ size_ml: number; qty: number }> | null;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  min_subtotal_cents: number;
};

async function getPromotion(slug: string): Promise<Promotion | null> {
  const r = await query<Promotion & { mix_config_raw: any }>(
    `SELECT id, slug, title, subtitle, description, type, value, bundle_price_cents,
            required_size_ml, mix_sizes, mix_config, quantity_to_take, quantity_to_pay,
            image_url, badge_text, badge_color,
            min_items, max_items, min_subtotal_cents
     FROM promotion
     WHERE slug = $1 AND active = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())`,
    [slug]
  );
  if (!r.rows[0]) return null;
  const p = r.rows[0];
  // Parsear mix_config de JSONB string a array
  if (p.mix_config && typeof p.mix_config === "string") {
    try { p.mix_config = JSON.parse(p.mix_config); } catch { p.mix_config = null; }
  }
  if (!Array.isArray(p.mix_config)) p.mix_config = null;
  return p;
}

async function getFragrances(sizeMl: number, mixSizes: boolean) {
  if (sizeMl <= 0 && !mixSizes) return [];
  const r = await query<{
    id: number; slug: string; brand: string; name: string; full_name: string;
    family: string | null; display_code: string | null; artistic_name: string | null;
    inspired_by_name: string | null; inspired_by_brand: string | null;
    image_url: string | null; image_version: number | null; gender: string;
    price_cents: number | null;
  }>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.display_code, f.artistic_name,
            f.inspired_by_name, f.inspired_by_brand, f.gender,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            MIN(p.price_cents) AS price_cents
     FROM fragrance f
     INNER JOIN presentation p ON p.fragrance_id = f.id AND p.active = TRUE
       AND ${sizeMl > 0 ? "p.size_ml = $1" : "TRUE"}
     WHERE f.active = TRUE AND p.price_cents IS NOT NULL AND p.price_cents > 0
       ${sizeMl > 0 ? "" : "AND p.size_ml > 0"}
     GROUP BY f.id
     ORDER BY f.brand, f.name
     LIMIT 200`,
    sizeMl > 0 ? [sizeMl] : []
  );
  return r.rows;
}

/**
 * Devuelve TODAS las fragancias con TODAS sus presentaciones activas.
 * Cada elemento del array `presentations` representa una opción seleccionable
 * con su propio size_ml y price_cents.
 */
type FragranceWithPresentations = {
  id: number; slug: string; brand: string; name: string; full_name: string;
  family: string | null; display_code: string | null; artistic_name: string | null;
  inspired_by_name: string | null; inspired_by_brand: string | null;
  image_url: string | null; image_version: number | null; gender: string;
  presentations: Array<{ size_ml: number; price_cents: number }>;
};

async function getFragrancesWithPresentations(
  sizesFilter?: number[]
): Promise<FragranceWithPresentations[]> {
  const r = await query<{
    id: number; slug: string; brand: string; name: string; full_name: string;
    family: string | null; display_code: string | null; artistic_name: string | null;
    inspired_by_name: string | null; inspired_by_brand: string | null;
    image_url: string | null; image_version: number | null; gender: string;
    size_ml: number; price_cents: number;
  }>(
    `SELECT f.id, f.slug, f.brand, f.name, f.full_name, f.family, f.display_code, f.artistic_name,
            f.inspired_by_name, f.inspired_by_brand, f.gender,
            CASE
              WHEN f.image_data IS NOT NULL THEN '/api/image/' || f.slug
              WHEN f.image_url IS NULL OR f.image_url LIKE '/fragancias/%' THEN NULL
              ELSE f.image_url
            END AS image_url,
            LENGTH(f.image_data) AS image_version,
            p.size_ml, p.price_cents
     FROM fragrance f
     INNER JOIN presentation p ON p.fragrance_id = f.id AND p.active = TRUE
       AND p.price_cents IS NOT NULL AND p.price_cents > 0
       ${sizesFilter && sizesFilter.length > 0 ? "AND p.size_ml = ANY($1::int[])" : ""}
     WHERE f.active = TRUE
     ORDER BY f.brand, f.name, p.size_ml`,
    sizesFilter && sizesFilter.length > 0 ? [sizesFilter] : []
  );

  // Agrupar presentaciones por fragancia
  const map = new Map<number, FragranceWithPresentations>();
  for (const row of r.rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        slug: row.slug,
        brand: row.brand,
        name: row.name,
        full_name: row.full_name,
        family: row.family,
        display_code: row.display_code,
        artistic_name: row.artistic_name,
        inspired_by_name: row.inspired_by_name,
        inspired_by_brand: row.inspired_by_brand,
        image_url: row.image_url,
        image_version: row.image_version,
        gender: row.gender,
        presentations: []
      });
    }
    map.get(row.id)!.presentations.push({ size_ml: row.size_ml, price_cents: row.price_cents });
  }
  return Array.from(map.values());
}

export async function generateMetadata({ params }: Props) {
  const p = await getPromotion(params.slug);
  if (!p) return { title: "Promoción no encontrada" };
  return {
    title: `${p.title} | Polianthes`,
    description: p.description ?? p.subtitle ?? `Promoción especial: ${p.title}. Envíos a todo México.`,
    alternates: { canonical: `/promociones/${p.slug}` },
    openGraph: {
      type: "website",
      locale: "es_MX",
      url: `${SITE_URL}/promociones/${p.slug}`,
      title: p.title,
      description: p.subtitle ?? p.description ?? "",
      images: p.image_url ? [p.image_url] : []
    }
  };
}

export default async function PromoPage({ params }: Props) {
  const promo = await getPromotion(params.slug);
  if (!promo) notFound();

  // Promos que NO requieren fragancias específicas (descuentos sobre el carrito)
  const isCartWidePromo = ["percent", "fixed", "free_shipping"].includes(promo.type);

  // Para bundle_mix, cargar fragancias por cada tamaño
  // Para bundle_mix, cargar fragancias con sus presentaciones filtradas por los tamaños del mix
  // Para otros promos (3x2, 2x1, bundle_qty), filtrar por required_size_ml si está definido
  let fragrances: any[] = [];

  if (!isCartWidePromo) {
    let sizesFilter: number[] | undefined = undefined;
    if (promo.type === "bundle_mix" && promo.mix_config && promo.mix_config.length > 0) {
      sizesFilter = Array.from(new Set(promo.mix_config.map((r) => r.size_ml)));
    } else if (promo.required_size_ml > 0) {
      sizesFilter = [promo.required_size_ml];
    } else if (promo.mix_sizes) {
      sizesFilter = undefined; // todos los tamaños
    }
    fragrances = await getFragrancesWithPresentations(sizesFilter);
  }

  return (
    <main className="pt-24 sm:pt-28 pb-16 sm:pb-20 px-4 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Hero de la promo */}
        <div className="liquid-glass rounded-2xl sm:rounded-3xl overflow-hidden">
          {promo.image_url ? (
            <div className="aspect-[16/7] sm:aspect-[16/5] bg-black/30 overflow-hidden">
              <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" loading="eager" fetchPriority="high" />
            </div>
          ) : null}
          <div className="p-5 sm:p-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-gold/80">// Promoción del mes</p>
            <h1 className="mt-2 font-display italic text-ink text-4xl sm:text-6xl leading-[0.95] tracking-[-2px]">
              {promo.title}
            </h1>
            {promo.subtitle && <p className="mt-3 text-lg text-ink-mute">{promo.subtitle}</p>}
            {promo.description && <p className="mt-4 text-sm text-ink/80 max-w-2xl mx-auto">{promo.description}</p>}
            {isCartWidePromo && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-4 py-1.5 text-xs text-gold">
                <span>Aplica automáticamente al pagar</span>
                <span>·</span>
                <span>No requiere selección de fragancias</span>
              </p>
            )}
          </div>
        </div>

        {/* Selector de fragancias (solo para promos que lo requieren) */}
        {isCartWidePromo ? (
          <PromoDiscount promo={promo} />
        ) : (
          <PromoPackage promo={promo} fragrances={fragrances} />
        )}
      </div>
    </main>
  );
}

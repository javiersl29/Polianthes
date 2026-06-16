import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import PromoPackage from "./PromoPackage";

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
  required_size_ml: number;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
};

async function getPromotion(slug: string): Promise<Promotion | null> {
  const r = await query<Promotion>(
    `SELECT id, slug, title, subtitle, description, type, value, required_size_ml,
            quantity_to_take, quantity_to_pay, image_url, badge_text, badge_color,
            min_items, max_items
     FROM promotion
     WHERE slug = $1 AND active = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())`,
    [slug]
  );
  return r.rows[0] ?? null;
}

async function getFragrances(sizeMl: number) {
  if (sizeMl <= 0) return [];
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
     INNER JOIN presentation p ON p.fragrance_id = f.id AND p.active = TRUE AND p.size_ml = $1
     WHERE f.active = TRUE AND p.price_cents IS NOT NULL AND p.price_cents > 0
     GROUP BY f.id
     ORDER BY f.brand, f.name
     LIMIT 200`,
    [sizeMl]
  );
  return r.rows;
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

  const fragrances = await getFragrances(promo.required_size_ml);

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
          </div>
        </div>

        {/* Selector de fragancias */}
        <PromoPackage promo={promo} fragrances={fragrances} />
      </div>
    </main>
  );
}

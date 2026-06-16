import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getFragranceBySlug, getSimilarFragrances } from "@/lib/fragrances";
import { genderBadge } from "@/lib/visual";
import AddToCart from "@/components/AddToCart";
import HexagonView from "@/components/HexagonView";
import FragranceReviews from "@/components/FragranceReviews";

export const revalidate = 600;

const SITE_URL = "https://polianthes.shop";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getFragranceBySlug(params.slug);
  if (!detail) {
    return { title: "Fragancia no encontrada" };
  }
  const title = detail.artistic_name
    ? `${detail.artistic_name} (${detail.brand}) — Polianthes`
    : `${detail.brand} ${detail.name} — Polianthes`;
  const description = detail.description
    ? detail.description.slice(0, 200)
    : `Perfume de inspiración ${detail.brand} ${detail.name}. Familia ${detail.family ?? "olfativa"}. Disponible en 10/30/60/100ml. Envíos a todo México.`;
  const imageUrl = detail.image_url ?? `${SITE_URL}/brand/Logo-Color.png`;
  const canonical = `/fragancias/${detail.slug}`;

  return {
    title,
    description,
    keywords: [
      detail.brand,
      detail.name,
      detail.family ?? "perfume",
      detail.gender,
      "perfume de inspiración",
      "Polianthes",
      ...(detail.top_notes ?? []).slice(0, 3)
    ],
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_MX",
      url: `${SITE_URL}${canonical}`,
      title,
      description,
      images: [{ url: imageUrl, alt: title }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    }
  };
}

function buildProductJsonLd(detail: NonNullable<Awaited<ReturnType<typeof getFragranceBySlug>>>) {
  const image = detail.image_url ?? `${SITE_URL}/brand/Logo-Color.png`;
  const offers: Array<Record<string, unknown>> = [];
  for (const p of detail.presentations ?? []) {
    if (p.price_cents == null) continue;
    const price = (p.price_cents / 100).toFixed(2);
    const ml = p.size_ml;
    offers.push({
      "@type": "Offer",
      price,
      priceCurrency: "MXN",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/fragancias/${detail.slug}`,
      sku: `${detail.display_code ?? `PLT-${detail.id}`}-${ml}`
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.artistic_name ?? `${detail.brand} ${detail.name}`,
    alternateName: detail.full_name,
    description: detail.description ?? `Perfume de inspiración ${detail.brand} ${detail.name}.`,
    image,
    brand: { "@type": "Brand", name: detail.brand },
    sku: detail.display_code ?? `PLT-${detail.id}`,
    category: detail.family ?? "Perfume",
    offers: offers.length > 0 ? offers : {
      "@type": "AggregateOffer",
      priceCurrency: "MXN",
      lowPrice: "100",
      highPrice: "450",
      offerCount: 4,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/fragancias/${detail.slug}`
    }
  };
}

export default async function FragrancePage({ params }: Props) {
  const detail = await getFragranceBySlug(params.slug);
  if (!detail) notFound();
  const similar = await getSimilarFragrances(params.slug, 5);

  const gender = genderBadge(detail.gender);
  const familyValues = {
    floral: detail.vec_floral,
    oriental: detail.vec_oriental,
    amaderado: detail.vec_amaderado,
    chipre: detail.vec_chipre,
    citrico: detail.vec_citrico,
    gourmand: detail.vec_gourmand
  };
  const moodValues = {
    frescura: detail.vec_frescura,
    misterio: detail.vec_misterio,
    romantico: detail.vec_romantico,
    energia: detail.vec_energia,
    sofisticado: detail.vec_sofisticado,
    nostalgico: detail.vec_nostalgico
  };

  const jsonLd = buildProductJsonLd(detail);

  return (
    <main className="pt-24 sm:pt-28 pb-16 sm:pb-20 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-5xl mx-auto">
        <Link
          href="/#catalogo"
          className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-gold transition-colors min-h-[44px]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Volver al catálogo
        </Link>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
          <div className="space-y-4">
            <div className="aspect-[3/4] rounded-2xl sm:rounded-3xl liquid-glass overflow-hidden grid place-items-center relative">
              {detail.image_url ? (
                <Image
                  src={detail.image_version != null ? `${detail.image_url}?v=${detail.image_version}` : detail.image_url}
                  alt={detail.full_name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  fetchPriority="high"
                  quality={80}
                  className="object-cover"
                />
              ) : (
                <span className="font-display italic text-gold text-6xl sm:text-7xl">{detail.brand[0]}</span>
              )}
            </div>
            {detail.inspiration_image_url && (
              <div className="aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden opacity-60 relative">
                <Image
                  src={detail.inspiration_image_url}
                  alt="Inspiración"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  loading="lazy"
                  quality={60}
                  className="object-cover"
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] sm:text-xs text-gold/80 uppercase tracking-[0.2em]">
                {detail.display_code ?? `PLT-${String(detail.id).padStart(3, "0")}`}
              </p>
              <span
                title={`Género: ${gender.label}`}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${gender.classes}`}
              >
                <span className="text-[11px] leading-none">{gender.icon}</span>
                <span>{gender.label}</span>
              </span>
            </div>
            <h1 className="mt-2 font-display italic text-ink text-4xl sm:text-5xl md:text-6xl leading-[0.9] tracking-[-2px]">
              {detail.artistic_name ?? `Polianthes ${String(detail.id).padStart(3, "0")}`}
            </h1>
            {(detail.inspired_by_name || detail.inspired_by_brand) && (
              <p className="mt-3 text-sm sm:text-base text-ink-mute italic leading-snug">
                Inspirado en <span className="text-ink not-italic font-medium">{detail.inspired_by_name ?? detail.name}</span>
                {detail.inspired_by_brand && (
                  <>
                    {" "}de <span className="text-gold not-italic font-semibold">{detail.inspired_by_brand}</span>
                  </>
                )}
              </p>
            )}
            {detail.family && (
              <p className="mt-3 text-sm text-gold">Familia: {detail.family}</p>
            )}
            {detail.mood && (
              <p className="mt-1 text-sm text-ink-mute italic">&ldquo;{detail.mood}&rdquo;</p>
            )}
            {detail.description && (
              <p className="mt-5 sm:mt-6 text-sm sm:text-base text-ink/90 leading-relaxed">{detail.description}</p>
            )}

            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {(["top_notes", "heart_notes", "base_notes"] as const).map((layer) => (
                <div key={layer} className="liquid-glass rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-mute">
                    {layer === "top_notes" ? "Salida" : layer === "heart_notes" ? "Corazón" : "Fondo"}
                  </p>
                  <ul className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                    {(detail[layer] ?? []).length === 0 ? (
                      <li className="text-[10px] sm:text-xs text-ink-mute">—</li>
                    ) : (
                      detail[layer].map((n) => (
                        <li key={n} className="text-xs sm:text-sm">{n}</li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 sm:mt-10">
              <AddToCart
                slug={detail.slug}
                brand={detail.brand}
                name={detail.name}
                image_url={detail.image_url}
                image_version={detail.image_version ?? null}
                artistic_name={detail.artistic_name}
                full_name={detail.full_name}
                presentations={detail.presentations}
              />
            </div>
          </div>
        </div>

        <section className="mt-12 sm:mt-16" aria-labelledby="hex-section">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs text-gold/80 uppercase tracking-[0.2em]">// Huella olfativa</p>
              <h2 id="hex-section" className="mt-1 font-display italic text-3xl sm:text-4xl text-ink leading-tight">
                Composición y ocasión
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink-mute mb-1">Familias</p>
              <h3 className="font-display italic text-xl sm:text-2xl text-ink mb-3 sm:mb-4">Composición</h3>
              <HexagonView values={familyValues} setId="familias" size={260} caption="Floral · Oriental · Amaderado · Chipre · Cítrico · Gourmand" />
            </div>
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink-mute mb-1">Mood</p>
              <h3 className="font-display italic text-xl sm:text-2xl text-ink mb-3 sm:mb-4">Ocasión</h3>
              <HexagonView values={moodValues} setId="mood" size={260} caption="Frescura · Misterio · Romántico · Energía · Sofisticado · Nostálgico" />
            </div>
          </div>
        </section>

        {similar.length > 0 && (
          <section className="mt-12 sm:mt-16" aria-labelledby="similar-section">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs text-gold/80 uppercase tracking-[0.2em]">// Afinidad olfativa</p>
                <h2 id="similar-section" className="mt-1 font-display italic text-3xl sm:text-4xl text-ink leading-tight">
                  Otras fragancias afines
                </h2>
              </div>
              <Link
                href="/#catalogo"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-ink-mute hover:text-gold transition-colors"
              >
                Ver todo el catálogo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {similar.map((s) => {
                const g = genderBadge(s.gender);
                return (
                  <Link
                    key={s.id}
                    href={`/fragancias/${s.slug}`}
                    className="liquid-glass rounded-2xl sm:rounded-3xl p-3 sm:p-4 hover:text-gold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold/5 group block h-full"
                  >
                    <div className="aspect-[3/4] rounded-xl sm:rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute relative">
                      {s.image_url ? (
                        <Image
                          src={s.image_version != null ? `${s.image_url}?v=${s.image_version}` : s.image_url}
                          alt={s.full_name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          loading="lazy"
                          quality={70}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="font-display italic text-gold text-3xl sm:text-4xl">{s.brand[0]}</span>
                      )}
                    </div>
                    <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1 min-w-0">
                      <p className="text-[10px] sm:text-[11px] text-gold/80 uppercase tracking-wider truncate min-w-0">
                        {s.display_code ?? `PLT-${String(s.id).padStart(3, "0")}`}
                      </p>
                      <span
                        title={`Género: ${g.label}`}
                        className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-semibold uppercase tracking-wide border ${g.classes}`}
                      >
                        <span className="text-[10px] leading-none">{g.icon}</span>
                      </span>
                    </div>
                    <p className="font-display italic text-sm sm:text-base text-ink leading-tight mt-0.5 line-clamp-2">
                      {s.artistic_name ?? `Polianthes ${String(s.id).padStart(3, "0")}`}
                    </p>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] text-ink-mute italic leading-snug line-clamp-2">
                      Inspirado en {s.name}
                    </p>
                    {s.family && <p className="mt-0.5 text-[10px] sm:text-[11px] text-gold/70">{s.family}</p>}
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <p className="text-[10px] sm:text-[11px] text-ink-mute">
                        Afinidad <span className="text-gold font-medium">{s.score}%</span>
                      </p>
                      {s.min_price_cents !== null && s.min_price_cents > 0 && (
                        <p className="text-[10px] sm:text-[11px] text-ink/80">
                          <span className="text-gold font-medium">${(s.min_price_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <FragranceReviews slug={params.slug} />
      </div>
    </main>
  );
}

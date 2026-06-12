import { notFound } from "next/navigation";
import Link from "next/link";
import { getFragranceBySlug, getSimilarFragrances } from "@/lib/fragrances";
import { genderBadge } from "@/lib/visual";
import AddToCart from "@/components/AddToCart";
import HexagonView from "@/components/HexagonView";

export const dynamic = "force-dynamic";

export default async function FragrancePage({ params }: { params: { slug: string } }) {
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

  return (
    <main className="pt-24 sm:pt-28 pb-16 sm:pb-20 px-4">
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
            <div className="aspect-[3/4] rounded-2xl sm:rounded-3xl liquid-glass overflow-hidden grid place-items-center">
              {detail.image_url ? (
                <img
                  src={detail.image_version != null ? `${detail.image_url}?v=${detail.image_version}` : detail.image_url}
                  alt={detail.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display italic text-gold text-6xl sm:text-7xl">{detail.brand[0]}</span>
              )}
            </div>
            {detail.inspiration_image_url && (
              <div className="aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden opacity-60">
                <img src={detail.inspiration_image_url} alt="Inspiración" className="w-full h-full object-cover" />
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
              <p className="mt-2 text-sm text-ink-mute italic">
                Inspirado en {detail.inspired_by_name ?? detail.name}
                {detail.inspired_by_brand && (
                  <>
                    {" "}de <span className="text-gold">{detail.inspired_by_brand}</span>
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

            <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-3">
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
                presentations={detail.presentations}
              />
            </div>
          </div>
        </div>

        {/* Hexágonos: composición (familias) y ocasión (mood) */}
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
              <HexagonView values={familyValues} setId="familias" size={300} caption="Floral · Oriental · Amaderado · Chipre · Cítrico · Gourmand" />
            </div>
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col items-center">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink-mute mb-1">Mood</p>
              <h3 className="font-display italic text-xl sm:text-2xl text-ink mb-3 sm:mb-4">Ocasión</h3>
              <HexagonView values={moodValues} setId="mood" size={300} caption="Frescura · Misterio · Romántico · Energía · Sofisticado · Nostálgico" />
            </div>
          </div>
        </section>

        {/* 5 fragancias con mayor afinidad olfativa */}
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
                    className="liquid-glass rounded-2xl sm:rounded-3xl p-3 sm:p-4 hover:text-gold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold/5 group block"
                  >
                    <div className="aspect-[3/4] rounded-xl sm:rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute">
                      {s.image_url ? (
                        <img
                          src={s.image_version != null ? `${s.image_url}?v=${s.image_version}` : s.image_url}
                          alt={s.full_name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="font-display italic text-gold text-3xl sm:text-4xl">{s.brand[0]}</span>
                      )}
                    </div>
                    <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
                      <p className="text-[10px] sm:text-[11px] text-gold/80 uppercase tracking-wider truncate">
                        {s.display_code ?? `PLT-${String(s.id).padStart(3, "0")}`}
                      </p>
                      <span
                        title={`Género: ${g.label}`}
                        className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-semibold uppercase tracking-wide border ${g.classes}`}
                      >
                        <span className="text-[10px] leading-none">{g.icon}</span>
                      </span>
                    </div>
                    <p className="font-display italic text-sm sm:text-base text-ink leading-tight mt-0.5 truncate">
                      {s.artistic_name ?? `Polianthes ${String(s.id).padStart(3, "0")}`}
                    </p>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] text-ink-mute italic truncate">
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
      </div>
    </main>
  );
}

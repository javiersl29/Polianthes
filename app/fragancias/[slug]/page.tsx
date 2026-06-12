import { notFound } from "next/navigation";
import Link from "next/link";
import { getFragranceBySlug } from "@/lib/fragrances";
import AddToCart from "@/components/AddToCart";

export const dynamic = "force-dynamic";

export default async function FragrancePage({ params }: { params: { slug: string } }) {
  const detail = await getFragranceBySlug(params.slug);
  if (!detail) notFound();

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
            <p className="text-[10px] sm:text-xs text-gold/80 uppercase tracking-[0.2em]">
              {detail.display_code ?? `PLT-${String(detail.id).padStart(3, "0")}`}
            </p>
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
      </div>
    </main>
  );
}

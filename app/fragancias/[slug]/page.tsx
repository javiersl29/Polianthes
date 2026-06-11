import { notFound } from "next/navigation";
import Link from "next/link";
import { getFragranceBySlug } from "@/lib/fragrances";

export const dynamic = "force-dynamic";

function priceLabel(cents: number | null) {
  if (cents === null || cents === undefined) return "Consultar";
  return `$${(cents / 100).toFixed(0)} MXN`;
}

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
                <img src={detail.image_url} alt={detail.full_name} className="w-full h-full object-cover" />
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
            <p className="text-[10px] sm:text-xs text-ink-mute uppercase tracking-[0.2em]">{detail.brand}</p>
            <h1 className="mt-2 font-display italic text-ink text-4xl sm:text-5xl md:text-6xl leading-[0.9] tracking-[-2px]">
              {detail.name}
            </h1>
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

            <div className="mt-6 sm:mt-8">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-ink-mute mb-2">Presentaciones</p>
              <div className="flex flex-wrap gap-2">
                {(detail.presentations ?? []).length === 0 && (
                  <span className="text-sm text-ink-mute">Sin presentaciones activas.</span>
                )}
                {detail.presentations.map((p) => (
                  <span
                    key={p.size_ml}
                    className="liquid-glass rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
                  >
                    {p.size_ml} ml <span className="text-gold ml-1">{priceLabel(p.price_cents)}</span>
                  </span>
                ))}
              </div>
            </div>

            <button className="liquid-glass-strong mt-8 sm:mt-10 w-full rounded-full px-5 py-3.5 sm:py-3 text-sm font-medium hover:text-gold transition-colors min-h-[48px]">
              Solicitar asesoría
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

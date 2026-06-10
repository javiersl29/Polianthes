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
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <Link href="/#catalogo" className="text-sm text-ink-mute hover:text-gold">← Volver al catálogo</Link>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="aspect-[3/4] rounded-3xl liquid-glass overflow-hidden grid place-items-center">
              {detail.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.image_url} alt={detail.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display italic text-gold text-7xl">{detail.brand[0]}</span>
              )}
            </div>
            {detail.inspiration_image_url && (
              <div className="aspect-[16/9] rounded-2xl overflow-hidden opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={detail.inspiration_image_url} alt="Inspiración" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-ink-mute uppercase tracking-[0.2em]">{detail.brand}</p>
            <h1 className="mt-2 font-display italic text-ink text-5xl md:text-6xl leading-[0.9] tracking-[-2px]">
              {detail.name}
            </h1>
            {detail.family && (
              <p className="mt-3 text-sm text-gold">Familia: {detail.family}</p>
            )}
            {detail.mood && (
              <p className="mt-1 text-sm text-ink-mute italic">"{detail.mood}"</p>
            )}
            {detail.description && (
              <p className="mt-6 text-ink/90 leading-relaxed">{detail.description}</p>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["top_notes", "heart_notes", "base_notes"] as const).map((layer) => (
                <div key={layer} className="liquid-glass rounded-2xl p-4">
                  <p className="text-[11px] uppercase tracking-wider text-ink-mute">
                    {layer === "top_notes" ? "Salida" : layer === "heart_notes" ? "Corazón" : "Fondo"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(detail[layer] ?? []).length === 0 ? (
                      <li className="text-xs text-ink-mute">—</li>
                    ) : (
                      detail[layer].map((n) => (
                        <li key={n} className="text-sm">{n}</li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-wider text-ink-mute mb-2">Presentaciones</p>
              <div className="flex flex-wrap gap-2">
                {(detail.presentations ?? []).length === 0 && (
                  <span className="text-sm text-ink-mute">Sin presentaciones activas.</span>
                )}
                {detail.presentations.map((p) => (
                  <span
                    key={p.size_ml}
                    className="liquid-glass rounded-full px-4 py-2 text-sm"
                  >
                    {p.size_ml} ml <span className="text-gold ml-1">{priceLabel(p.price_cents)}</span>
                  </span>
                ))}
              </div>
            </div>

            <button className="liquid-glass-strong mt-10 w-full rounded-full px-5 py-3 text-sm font-medium hover:text-gold transition-colors">
              Solicitar asesoría
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

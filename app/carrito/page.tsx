"use client";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/cart";

export default function CartPage() {
  const { items, setQty, remove, clear, total } = useCart();

  if (items.length === 0) {
    return (
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-ink-mute">// Carrito</p>
          <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Tu carrito está vacío</h1>
          <p className="mt-4 text-ink-mute">
            Explora nuestra curaduría de perfumes y añade tus fragancias favoritas.
          </p>
          <Link
            href="/#catalogo"
            className="inline-block mt-8 rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90"
          >
            Ver catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-ink-mute">// Carrito</p>
            <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-1px]">Tu selección</h1>
          </div>
          <button
            onClick={clear}
            className="text-xs text-ink-mute hover:text-rose-300 transition-colors"
          >
            Vaciar carrito
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 liquid-glass rounded-2xl divide-y divide-line">
            {items.map((it) => (
              <div key={`${it.slug}-${it.size_ml}`} className="p-4 sm:p-5 flex gap-3 sm:gap-4">
                <Link
                  href={`/fragancias/${it.slug}`}
                  className="w-20 h-24 sm:w-24 sm:h-28 rounded-lg bg-black/30 overflow-hidden shrink-0 grid place-items-center"
                >
                  {it.image_url ? (
                    <img
                      src={it.image_version != null ? `${it.image_url}?v=${it.image_version}` : it.image_url}
                      alt={it.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gold/40 text-lg">{it.brand[0]}</span>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/fragancias/${it.slug}`}
                    className="font-display italic text-lg text-ink hover:text-gold transition-colors"
                  >
                    {it.artistic_name ?? it.name}
                  </Link>
                  <p className="text-xs text-ink-mute">{it.brand} · {it.size_ml}ml</p>
                  <p className="text-xs text-gold/70 mt-0.5">{money(it.unit_price_cents)} c/u</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-full liquid-glass">
                      <button
                        onClick={() => setQty(it.slug, it.size_ml, it.qty - 1)}
                        className="h-8 w-8 rounded-full text-ink/80 hover:text-gold"
                        aria-label="Disminuir"
                      >−</button>
                      <span className="w-8 text-center text-sm">{it.qty}</span>
                      <button
                        onClick={() => setQty(it.slug, it.size_ml, it.qty + 1)}
                        className="h-8 w-8 rounded-full text-ink/80 hover:text-gold"
                        aria-label="Aumentar"
                      >+</button>
                    </div>
                    <button
                      onClick={() => remove(it.slug, it.size_ml)}
                      className="text-xs text-rose-300/80 hover:text-rose-300"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gold font-medium shrink-0 self-start">
                  {money(it.unit_price_cents * it.qty)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="liquid-glass rounded-2xl p-5 sticky top-24">
              <h2 className="font-display italic text-2xl text-ink mb-3">Resumen</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Subtotal ({total.units}u)</span>
                  <span className="text-ink">{money(total.total_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-mute">Envío</span>
                  <span className="text-ink-mute">Se calcula en el checkout</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line flex justify-between text-base font-medium">
                <span className="text-ink">Total estimado</span>
                <span className="text-gold">{money(total.total_cents)}</span>
              </div>
              <Link
                href="/checkout"
                className="block mt-5 text-center rounded-full bg-gold text-bg px-5 py-3 text-sm font-medium hover:bg-gold/90"
              >
                Finalizar compra
              </Link>
              <Link
                href="/#catalogo"
                className="block mt-2 text-center text-xs text-ink-mute hover:text-gold"
              >
                Seguir explorando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/cart";

export default function CartDrawer() {
  const { items, promo, isOpen, close, setQty, remove, total, clear, setPromo } = useCart();
  const hasDiscount = total.discount_cents > 0;
  const removePromo = () => setPromo(null);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 bg-bg-elev border-l border-line flex flex-col"
            aria-label="Carrito de compras"
          >
            <header className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gold/80 uppercase tracking-wider">// Carrito</p>
                <h2 className="font-display italic text-2xl text-ink">Tu selección</h2>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={() => { if (confirm("¿Vaciar todo el carrito?")) clear(); }}
                    className="text-[11px] text-ink-mute/70 hover:text-rose-300 transition-colors px-2 py-1"
                    title="Vaciar carrito"
                  >
                    Vaciar
                  </button>
                )}
                <button
                  onClick={close}
                  aria-label="Cerrar"
                  className="h-9 w-9 rounded-full liquid-glass grid place-items-center hover:text-gold"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-display italic text-xl text-ink">Tu carrito está vacío</p>
                  <p className="mt-2 text-sm text-ink-mute">
                    Explora el catálogo y añade tus fragancias favoritas.
                  </p>
                  <Link
                    href="/#catalogo"
                    onClick={close}
                    className="inline-block mt-4 rounded-full bg-gold text-bg px-5 py-2 text-sm font-medium hover:bg-gold/90"
                  >
                    Ver catálogo
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((it) => (
                    <li key={`${it.slug}-${it.size_ml}`} className="p-4 flex gap-3">
                      <div className="w-16 h-20 rounded-lg bg-black/30 overflow-hidden shrink-0 grid place-items-center">
                        {it.image_url ? (
                          <img
                            src={it.image_version != null ? `${it.image_url}?v=${it.image_version}` : it.image_url}
                            alt={it.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-gold/40 text-xs">{it.brand[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">
                          {it.artistic_name ?? it.name}
                        </p>
                        <p className="text-[11px] text-ink-mute truncate">{it.brand} · {it.size_ml}ml</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex items-center rounded-full liquid-glass">
                            <button
                              onClick={() => setQty(it.slug, it.size_ml, it.qty - 1)}
                              className="h-7 w-7 rounded-full text-ink/80 hover:text-gold"
                              aria-label="Disminuir"
                            >−</button>
                            <span className="w-6 text-center text-xs">{it.qty}</span>
                            <button
                              onClick={() => setQty(it.slug, it.size_ml, it.qty + 1)}
                              className="h-7 w-7 rounded-full text-ink/80 hover:text-gold"
                              aria-label="Aumentar"
                            >+</button>
                          </div>
                          <button
                            onClick={() => remove(it.slug, it.size_ml)}
                            className="text-[11px] text-rose-300/80 hover:text-rose-300"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gold font-medium shrink-0">
                        {money(it.unit_price_cents * it.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="p-4 sm:p-5 border-t border-line space-y-3">
                {promo && (
                  <div className="rounded-xl bg-gold/10 border border-gold/30 p-2.5 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold shrink-0">
                      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gold font-semibold truncate">{promo.title}</p>
                      {hasDiscount && (
                        <p className="text-[10px] text-ink-mute">−{money(total.discount_cents)}</p>
                      )}
                    </div>
                    <button
                      onClick={removePromo}
                      className="text-ink-mute hover:text-rose-300 p-0.5"
                      aria-label="Quitar promoción"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                {hasDiscount && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-mute">Subtotal</span>
                      <span className="text-ink-mute line-through">{money(total.subtotal_cents)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-300">Descuento</span>
                      <span className="text-emerald-300">−{money(total.discount_cents)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-mute">{hasDiscount ? "Total" : `Subtotal (${total.units}u)`}</span>
                  <span className={`${hasDiscount ? "text-gold font-display italic text-2xl" : "text-gold font-medium"}`}>
                    {money(total.total_cents)}
                  </span>
                </div>
                <p className="text-[11px] text-ink-mute">
                  Envío e impuestos se calculan en el checkout.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/carrito"
                    onClick={close}
                    className="text-center rounded-full liquid-glass border border-line px-4 py-2.5 text-sm hover:border-gold/40"
                  >
                    Ver carrito
                  </Link>
                  <Link
                    href={promo ? `/checkout?promo=${promo.slug}` : "/checkout"}
                    onClick={close}
                    className="text-center rounded-full bg-gold text-bg px-4 py-2.5 text-sm font-medium hover:bg-gold/90"
                  >
                    Finalizar compra
                  </Link>
                </div>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

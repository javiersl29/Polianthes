"use client";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";

type Promotion = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  value: number;
  min_subtotal_cents: number;
  required_size_ml: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

const TYPE_LABELS: Record<string, { title: string; desc: string; icon: string; color: string }> = {
  percent: {
    title: "Descuento porcentual",
    desc: "Se aplica un % de descuento sobre el subtotal de tu carrito al momento de pagar.",
    icon: "💯",
    color: "from-sky-500/20 to-blue-500/10 border-sky-500/30"
  },
  fixed: {
    title: "Descuento fijo",
    desc: "Se descuenta una cantidad fija en pesos del subtotal de tu carrito.",
    icon: "💵",
    color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30"
  },
  free_shipping: {
    title: "Envío gratis",
    desc: "El envío de tu pedido sale completamente gratis.",
    icon: "🚚",
    color: "from-cyan-500/20 to-sky-500/10 border-cyan-500/30"
  }
};

export default function PromoDiscount({ promo }: { promo: Promotion }) {
  const { items, total, setPromo } = useCart();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const label = TYPE_LABELS[promo.type] || TYPE_LABELS.percent;

  const subtotal = total.subtotal_cents;
  const meetsMin = !promo.min_subtotal_cents || subtotal >= promo.min_subtotal_cents;
  const progress = promo.min_subtotal_cents ? Math.min(100, (subtotal / promo.min_subtotal_cents) * 100) : 100;
  const missing = promo.min_subtotal_cents ? Math.max(0, promo.min_subtotal_cents - subtotal) : 0;

  const estimatedDiscount = useMemo(() => {
    if (!meetsMin) return 0;
    if (promo.type === "percent") return Math.round(subtotal * (promo.value / 100));
    if (promo.type === "fixed") return Math.min(subtotal, promo.value);
    return 0;
  }, [promo, subtotal, meetsMin]);

  const colorClass = label.color;
  const inCart = hydrated && items.length > 0;

  function applyAndGoCheckout() {
    setPromo({
      slug: promo.slug,
      type: promo.type as any,
      title: promo.title,
      value: promo.value,
    });
    window.location.href = "/checkout";
  }

  return (
    <div className="mt-6 sm:mt-8 space-y-4">
      {/* Resumen del tipo de promo */}
      <div className={`liquid-glass rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${colorClass}`}>
        <div className="flex items-start gap-3">
          <span className="text-3xl">{label.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider opacity-70">Tipo de promoción</p>
            <p className="text-xl sm:text-2xl font-display italic mt-0.5">{label.title}</p>
            <p className="text-sm mt-2 opacity-80">{label.desc}</p>
          </div>
        </div>
      </div>

      {/* Cómo aplicar la promo */}
      <div className="liquid-glass rounded-2xl p-5 sm:p-6 space-y-4">
        <p className="text-[11px] uppercase tracking-wider text-gold/80">Cómo aplicar</p>

        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold grid place-items-center text-xs font-bold">1</span>
            <p className="text-sm text-ink leading-relaxed">
              Añade fragancias a tu carrito desde nuestro{" "}
              <Link href="/#catalogo" className="text-gold underline hover:text-gold/80">catálogo</Link>.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold grid place-items-center text-xs font-bold">2</span>
            <p className="text-sm text-ink leading-relaxed">
              El descuento se <strong>aplica automáticamente</strong> en el checkout al detectar esta promoción.
            </p>
          </li>
          {promo.min_subtotal_cents > 0 && (
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold grid place-items-center text-xs font-bold">3</span>
              <p className="text-sm text-ink leading-relaxed">
                Esta promoción requiere un <strong>pedido mínimo de {money(promo.min_subtotal_cents)}</strong>.
              </p>
            </li>
          )}
        </ol>

        {/* Estado del carrito */}
        {hydrated && (
          <div className="rounded-xl bg-black/30 border border-line/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-mute">Tu carrito actual</span>
              <span className="text-ink">{items.length > 0 ? `${items.length} fragancia${items.length > 1 ? "s" : ""} · ${money(subtotal)}` : "Vacío"}</span>
            </div>

            {promo.min_subtotal_cents > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={meetsMin ? "text-emerald-300" : "text-rose-300"}>
                    {meetsMin ? "✓ Pedido mínimo alcanzado" : `Faltan ${money(missing)}`}
                  </span>
                  <span className="text-ink-mute">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <motion.div
                    className={meetsMin ? "h-full bg-emerald-400" : "h-full bg-gold"}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-[10px] text-ink-mute mt-1">
                  Mínimo: {money(promo.min_subtotal_cents)}
                </p>
              </div>
            )}

            {inCart && meetsMin && estimatedDiscount > 0 && (
              <div className="rounded-lg bg-emerald-400/10 border border-emerald-400/30 p-3 text-sm">
                <p className="text-emerald-300 font-semibold">
                  Te ahorras {money(estimatedDiscount)} con esta promo
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/#catalogo"
          className="flex-1 text-center rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90 transition-colors min-h-[48px] flex items-center justify-center gap-2"
        >
          {inCart ? "Seguir comprando" : "Explorar catálogo"} →
        </Link>
        {inCart && (
          <button
            type="button"
            onClick={applyAndGoCheckout}
            disabled={!meetsMin}
            className="flex-1 rounded-full liquid-glass border border-gold px-6 py-3 text-sm font-medium hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            Ir al checkout con esta promo
          </button>
        )}
      </div>
    </div>
  );
}

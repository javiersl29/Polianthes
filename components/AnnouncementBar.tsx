"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type MarqueeItem = {
  id: string;
  text: string;
  link_url: string | null;
  link_label: string;
  icon: string;
};

const ICONS: Record<string, string> = {
  "3x2": "🎁",
  "2x1": "🎀",
  bundle_qty: "📦",
  bundle_mix: "🧩",
  second_unit: "🏷️",
  percent: "💯",
  fixed: "💵",
  free_shipping: "🚚",
  bundle: "🎁",
  tiered: "📊",
};

function money(cents: number) {
  return "$" + (cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

function promoToText(p: any): { text: string; link_url: string } {
  const url = `/promociones/${p.slug}`;
  switch (p.type) {
    case "3x2":
      return { text: `3x2 en fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""}`, link_url: url };
    case "2x1":
      return { text: `2x1 en fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""}`, link_url: url };
    case "bundle_qty":
      return { text: `${p.quantity_to_take} fragancias${p.required_size_ml ? ` de ${p.required_size_ml}ml` : ""} por ${money(p.bundle_price_cents)}`, link_url: url };
    case "bundle_mix":
      return { text: `Pack mixto ${p.mix_config?.map((r: any) => `${r.qty}×${r.size_ml}ml`).join("+") ?? ""} por ${money(p.bundle_price_cents)}`, link_url: url };
    case "second_unit":
      return { text: `2da unidad a ${p.value}%`, link_url: url };
    case "percent": {
      const min = p.min_subtotal_cents > 0 ? ` en compras +${money(p.min_subtotal_cents)}` : "";
      return { text: `${p.value}% de descuento${min}`, link_url: url };
    }
    case "fixed":
      return { text: `${money(p.value)} de descuento`, link_url: url };
    case "free_shipping":
      return { text: `Envío gratis`, link_url: url };
    default:
      return { text: p.title, link_url: url };
  }
}

export default function AnnouncementBar() {
  const [items, setItems] = useState<MarqueeItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/announcements").then(r => r.json()).catch(() => ({ announcements: [] })),
      fetch("/api/public/promotions").then(r => r.json()).catch(() => ({ promotions: [] })),
    ]).then(([annData, promoData]) => {
      const announcements: MarqueeItem[] = (annData.announcements ?? []).map((a: any) => ({
        id: `ann-${a.id}`,
        text: a.text,
        link_url: a.link_url,
        link_label: a.link_label || "Ver más",
        icon: a.icon || "✨",
      }));

      const promos: MarqueeItem[] = (promoData.promotions ?? []).map((p: any) => {
        const { text, link_url } = promoToText(p);
        return {
          id: `promo-${p.id}`,
          text,
          link_url,
          link_label: "Ver →",
          icon: ICONS[p.type] || "🎁",
        };
      });

      // Intercalar: anuncios + promos
      const merged = [...announcements, ...promos];
      setItems(merged);
    });
  }, []);

  if (items.length === 0) return null;

  // Duplicar para loop continuo
  const loop = [...items, ...items];

  return (
    <section
      className="relative bg-gradient-to-r from-gold/10 via-amber-500/5 to-gold/10 border-y border-gold/20 overflow-hidden"
      aria-label="Avisos y promociones"
    >
      {/* Difuminado en bordes */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-bg to-transparent z-10" />

      <div className="marquee-track">
        <div className="marquee-content">
          {loop.map((a, i) => (
            <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 px-5 sm:px-7 py-2.5 shrink-0">
              <span className="text-sm sm:text-base">{a.icon}</span>
              <span className="text-xs sm:text-sm font-medium text-gold whitespace-nowrap">
                {a.text}
              </span>
              {a.link_url && (
                <Link
                  href={a.link_url}
                  className="text-[10px] sm:text-xs font-bold text-gold/70 underline hover:text-gold whitespace-nowrap"
                >
                  {a.link_label}
                </Link>
              )}
              <span className="ml-4 sm:ml-6 text-lg text-gold/25">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type Announcement = {
  id: number;
  text: string;
  link_url: string | null;
  link_label: string;
  icon: string;
  bg_color: string;
};

const COLOR_STYLES: Record<string, { bg: string; text: string; separator: string }> = {
  gold:    { bg: "bg-gradient-to-r from-gold/15 via-amber-500/8 to-gold/15",       text: "text-gold",       separator: "text-gold/40" },
  emerald: { bg: "bg-gradient-to-r from-emerald-500/12 via-teal-500/6 to-emerald-500/12", text: "text-emerald-300", separator: "text-emerald-400/40" },
  rose:    { bg: "bg-gradient-to-r from-rose-500/12 via-pink-500/6 to-rose-500/12", text: "text-rose-300",    separator: "text-rose-400/40" },
  sky:     { bg: "bg-gradient-to-r from-sky-500/12 via-blue-500/6 to-sky-500/12",   text: "text-sky-300",     separator: "text-sky-400/40" },
  violet:  { bg: "bg-gradient-to-r from-violet-500/12 via-purple-500/6 to-violet-500/12", text: "text-violet-300", separator: "text-violet-400/40" },
  dark:    { bg: "bg-gradient-to-r from-bg-elev/80 via-black/60 to-bg-elev/80",     text: "text-gold",        separator: "text-gold/30" },
};

export default function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch("/api/public/announcements")
      .then(r => r.json())
      .then(data => {
        if (data.announcements?.length > 0) setItems(data.announcements);
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  // Determinar colores: usar el del primer item activo o gold por defecto
  const colorKey = items[0]?.bg_color ?? "gold";
  const colors = COLOR_STYLES[colorKey] ?? COLOR_STYLES.gold;

  // Duplicar la lista para que el loop sea continuo sin saltos
  const loop = [...items, ...items];

  return (
    <section
      className={`relative ${colors.bg} border-y border-line/30 overflow-hidden`}
      aria-label="Avisos y promociones"
    >
      {/* Gradiente difuminado en los bordes */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-bg to-transparent z-10" />

      {/* Marquesina */}
      <div className="marquee-track">
        <div className="marquee-content">
          {loop.map((a, i) => (
            <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 px-6 sm:px-8 py-2.5 shrink-0">
              <span className="text-sm sm:text-base">{a.icon}</span>
              <span className={`text-xs sm:text-sm font-medium ${colors.text} whitespace-nowrap`}>
                {a.text}
              </span>
              {a.link_url && (
                <Link
                  href={a.link_url}
                  className={`text-[10px] sm:text-xs font-bold underline ${colors.text} opacity-70 hover:opacity-100`}
                >
                  {a.link_label} →
                </Link>
              )}
              <span className={`ml-4 sm:ml-6 text-lg ${colors.separator}`}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

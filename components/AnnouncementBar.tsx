"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Announcement = {
  id: number;
  text: string;
  link_url: string | null;
  link_label: string;
  icon: string;
  bg_color: string;
};

const COLOR_STYLES: Record<string, { bg: string; text: string; accent: string }> = {
  gold:    { bg: "from-gold/20 via-amber-500/10 to-gold/20",       text: "text-gold",    accent: "bg-gold text-bg" },
  emerald: { bg: "from-emerald-500/15 via-teal-500/8 to-emerald-500/15", text: "text-emerald-300", accent: "bg-emerald-500 text-white" },
  rose:    { bg: "from-rose-500/15 via-pink-500/8 to-rose-500/15",  text: "text-rose-300", accent: "bg-rose-500 text-white" },
  sky:     { bg: "from-sky-500/15 via-blue-500/8 to-sky-500/15",    text: "text-sky-300",  accent: "bg-sky-500 text-white" },
  violet:  { bg: "from-violet-500/15 via-purple-500/8 to-violet-500/15", text: "text-violet-300", accent: "bg-violet-500 text-white" },
  dark:    { bg: "from-bg-elev/80 via-black/60 to-bg-elev/80",      text: "text-gold",    accent: "bg-gold text-bg" },
};

export default function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/public/announcements")
      .then(r => r.json())
      .then(data => {
        if (data.announcements?.length > 0) setItems(data.announcements);
      })
      .catch(() => {});
  }, []);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent(i => (i + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  // Auto-play cada 4.5s
  useEffect(() => {
    if (items.length <= 1 || paused) return;
    timerRef.current = setInterval(next, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, paused, next]);

  if (items.length === 0) return null;
  const a = items[current];
  if (!a) return null;
  const colors = COLOR_STYLES[a.bg_color] ?? COLOR_STYLES.gold;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <section
      className={`relative bg-gradient-to-r ${colors.bg} border-y border-line/40 overflow-hidden`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Avisos y promociones"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative h-11 sm:h-12 grid place-items-center">
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={a.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center gap-2 sm:gap-3 px-8 sm:px-12"
            >
              <span className="text-base sm:text-lg shrink-0">{a.icon}</span>
              <p className={`text-xs sm:text-sm font-medium ${colors.text} text-center truncate`}>
                {a.text}
              </p>
              {a.link_url && (
                <Link
                  href={a.link_url}
                  className={`shrink-0 rounded-full ${colors.accent} px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold whitespace-nowrap hover:scale-105 transition-transform`}
                >
                  {a.link_label} →
                </Link>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Flecha izquierda */}
          {items.length > 1 && (
            <button
              onClick={prev}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full liquid-glass grid place-items-center text-ink/60 hover:text-gold transition-colors z-10"
              aria-label="Anterior"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}

          {/* Flecha derecha */}
          {items.length > 1 && (
            <button
              onClick={next}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full liquid-glass grid place-items-center text-ink/60 hover:text-gold transition-colors z-10"
              aria-label="Siguiente"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
        </div>

        {/* Dots */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1 pb-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`h-1 rounded-full transition-all ${i === current ? `w-5 ${colors.text} opacity-100 bg-current` : "w-1 bg-ink-mute/30 hover:bg-ink-mute/50"}`}
                aria-label={`Ir al aviso ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

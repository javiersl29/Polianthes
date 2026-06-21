"use client";
import { useEffect, useState, useCallback } from "react";
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

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  gold: { bg: "from-gold/90 via-amber-500/80 to-gold/90", text: "text-bg", border: "border-gold/50" },
  emerald: { bg: "from-emerald-500/90 via-teal-500/80 to-emerald-500/90", text: "text-white", border: "border-emerald-400/50" },
  rose: { bg: "from-rose-500/90 via-pink-500/80 to-rose-500/90", text: "text-white", border: "border-rose-400/50" },
  sky: { bg: "from-sky-500/90 via-blue-500/80 to-sky-500/90", text: "text-white", border: "border-sky-400/50" },
  violet: { bg: "from-violet-500/90 via-purple-500/80 to-violet-500/90", text: "text-white", border: "border-violet-400/50" },
  dark: { bg: "from-bg-elev via-black/90 to-bg-elev", text: "text-gold", border: "border-gold/30" },
};

const DISMISS_KEY = "polianthes_announcement_dismissed";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/public/announcements")
      .then(r => r.json())
      .then(data => {
        if (data.announcements?.length > 0) {
          setAnnouncements(data.announcements);
          const d = sessionStorage.getItem(DISMISS_KEY);
          setDismissed(d);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Auto-rotate announcements every 5s
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(i => (i + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  const dismiss = useCallback(() => {
    const ids = announcements.map(a => a.id).join(",");
    sessionStorage.setItem(DISMISS_KEY, ids);
    setDismissed(ids);
  }, [announcements]);

  // Reset rotation when dismissed changes
  useEffect(() => { setCurrentIdx(0); }, [dismissed]);

  if (!loaded || announcements.length === 0) return null;

  // Check if current set was dismissed
  const currentIds = announcements.map(a => a.id).join(",");
  if (dismissed === currentIds) return null;

  const current = announcements[currentIdx] ?? announcements[0];
  if (!current) return null;
  const colors = COLOR_STYLES[current.bg_color] ?? COLOR_STYLES.gold;

  return (
    <div className={`relative z-[60] bg-gradient-to-r ${colors.bg} ${colors.border} border-b`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 py-1.5 sm:py-2">
          {/* Icon */}
          <span className="text-sm sm:text-base shrink-0">{current.icon}</span>

          {/* Rotating text */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <p className={`text-[11px] sm:text-sm font-medium ${colors.text} truncate`}>
                  {current.text}
                </p>
                {current.link_url && (
                  <Link
                    href={current.link_url}
                    className={`shrink-0 text-[10px] sm:text-xs font-bold underline ${colors.text} opacity-80 hover:opacity-100`}
                  >
                    {current.link_label} →
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots indicator (if multiple) */}
          {announcements.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-1 rounded-full transition-all ${colors.text} ${
                    i === currentIdx ? "w-4 opacity-100" : "w-1 opacity-40 hover:opacity-70"
                  }`}
                  aria-label={`Aviso ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className={`shrink-0 p-0.5 ${colors.text} opacity-60 hover:opacity-100`}
            aria-label="Cerrar aviso"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

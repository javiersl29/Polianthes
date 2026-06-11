"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/#decodificador", label: "Decodificador" },
  { href: "/#capacidades", label: "Capacidades" },
  { href: "/#catalogo", label: "Catálogo" }
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <header className="fixed top-3 sm:top-4 left-0 right-0 z-50 px-3 sm:px-4 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          aria-label="Polianthes"
          className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center text-xl sm:text-2xl font-display italic text-gold shrink-0"
        >
          p
        </Link>

        <nav className="hidden md:flex items-center gap-1 liquid-glass rounded-full px-1.5 py-1.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href ? "text-gold" : "text-ink/90 hover:text-gold"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/#decodificador"
            className="ml-1 inline-flex items-center gap-1 bg-ink text-bg rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-gold transition-colors"
          >
            Descifrar mi fragancia
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </Link>
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
        >
          <div className="relative w-5 h-4">
            <motion.span
              className="absolute left-0 right-0 h-[1.5px] bg-ink rounded-full origin-center"
              animate={menuOpen ? { top: "50%", rotate: 45, translateY: "-50%" } : { top: "0%", rotate: 0, translateY: "0%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            />
            <motion.span
              className="absolute left-0 right-0 top-[50%] h-[1.5px] bg-ink rounded-full -translate-y-1/2"
              animate={menuOpen ? { scaleX: 0, opacity: 0 } : { scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            />
            <motion.span
              className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-ink rounded-full origin-center"
              animate={menuOpen ? { top: "50%", rotate: -45, translateY: "-50%" } : { top: "auto", rotate: 0, translateY: "0%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden mt-2 liquid-glass-strong rounded-2xl p-3 max-w-xs ml-auto"
          >
            <nav className="flex flex-col gap-1">
              {links.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={l.href}
                    onClick={close}
                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      pathname === l.href ? "text-gold bg-white/5" : "text-ink/90 hover:text-gold hover:bg-white/[0.03]"
                    }`}
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + links.length * 0.04, duration: 0.3 }}
              >
                <Link
                  href="/#decodificador"
                  onClick={close}
                  className="block mt-1 bg-ink text-bg rounded-xl px-4 py-3 text-sm font-medium text-center hover:bg-gold transition-colors"
                >
                  Descifrar mi fragancia
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

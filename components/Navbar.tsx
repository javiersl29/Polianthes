"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartProvider";

type NavLink = {
  id: number;
  label: string;
  href: string;
  icon: string | null;
  new_tab: boolean;
  sort_order: number;
};

const FALLBACK_LINKS: NavLink[] = [
  { id: 1, label: "Inicio", href: "/", icon: null, new_tab: false, sort_order: 0 },
  { id: 2, label: "Decodificador", href: "/#decodificador", icon: null, new_tab: false, sort_order: 10 },
  { id: 3, label: "Capacidades", href: "/#capacidades", icon: null, new_tab: false, sort_order: 20 },
  { id: 4, label: "Catálogo", href: "/#catalogo", icon: null, new_tab: false, sort_order: 30 }
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [links, setLinks] = useState<NavLink[]>(FALLBACK_LINKS);
  const { total, toggle } = useCart();

  // Cargar links dinámicos desde la API. Si falla, usar fallbacks.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/nav?location=navbar")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.links?.length > 0) {
          setLinks(data.links);
        }
      })
      .catch(() => { /* usar fallback */ });
    return () => { cancelled = true; };
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <header className="fixed top-3 sm:top-4 left-0 right-0 z-30 px-3 sm:px-4 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          aria-label="Polianthes"
          className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0 overflow-hidden"
        >
          <img
            src="/brand/Isotipo-Blanco.png"
            alt=""
            width={36}
            height={36}
            className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1 liquid-glass rounded-full px-1.5 py-1.5">
          {links.map((l) => (
            <Link
              key={l.id}
              href={l.href}
              target={l.new_tab ? "_blank" : undefined}
              rel={l.new_tab ? "noopener noreferrer" : undefined}
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

        <div className="flex items-center gap-2">
          {/* Carrito */}
          <button
            onClick={toggle}
            aria-label={`Carrito con ${total.units} artículos`}
            className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0 relative hover:text-gold transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {total.units > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-bg text-[10px] font-bold grid place-items-center">
                {total.units > 99 ? "99+" : total.units}
              </span>
            )}
          </button>

          {/* Hamburguesa móvil */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden liquid-glass h-10 w-10 rounded-full grid place-items-center shrink-0"
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
                  key={l.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={l.href}
                    target={l.new_tab ? "_blank" : undefined}
                    rel={l.new_tab ? "noopener noreferrer" : undefined}
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
                  href="/checkout"
                  onClick={close}
                  className="block mt-1 bg-ink text-bg rounded-xl px-4 py-3 text-sm font-medium text-center hover:bg-gold transition-colors"
                >
                  Ver carrito y comprar
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

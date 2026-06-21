"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartProvider";
import { toast } from "sonner";

type NavLink = {
  id: number;
  label: string;
  href: string;
  icon: string | null;
  new_tab: boolean;
  sort_order: number;
};

type Customer = {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  affiliated: boolean;
};

const FALLBACK_LINKS: NavLink[] = [
  { id: 1, label: "Inicio", href: "/", icon: null, new_tab: false, sort_order: 0 },
  { id: 5, label: "Promociones", href: "/#ofertas", icon: null, new_tab: false, sort_order: 5 },
  { id: 2, label: "Decodificador", href: "/#decodificador", icon: null, new_tab: false, sort_order: 10 },
  { id: 3, label: "Capacidades", href: "/#capacidades", icon: null, new_tab: false, sort_order: 20 },
  { id: 4, label: "Catálogo", href: "/#catalogo", icon: null, new_tab: false, sort_order: 30 }
];

export default function Navbar() {
  return (
    <Suspense fallback={<NavbarFallback />}>
      <NavbarInner />
    </Suspense>
  );
}

function NavbarFallback() {
  const { total, toggle } = useCart();
  return (
    <header className="fixed top-3 sm:top-4 left-0 right-0 z-30 px-3 sm:px-4 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <Link href="/" aria-label="Polianthes" className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0 overflow-hidden">
          <img src="/brand/Isotipo-Blanco.png" alt="" width={36} height={36} className="h-6 w-6 sm:h-7 sm:h-7 object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggle} aria-label={`Carrito con ${total.units} artículos`} className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0 relative hover:text-gold transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavbarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [affiliatePromptOpen, setAffiliatePromptOpen] = useState(false);
  const [links, setLinks] = useState<NavLink[]>(FALLBACK_LINKS);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const { total, toggle } = useCart();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú de usuario al hacer click fuera
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  // Cerrar menú de usuario al cambiar de ruta
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

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

  // Cargar sesión de cliente
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/customer/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (!cancelled) setCustomer(data?.customer ?? null); })
        .catch(() => { if (!cancelled) setCustomer(null); });
    };
    load();
    return () => { cancelled = true; };
  }, [pathname]);

  // Mostrar modal de afiliación tras login si ?affiliate=prompt
  useEffect(() => {
    if (searchParams.get("affiliate") === "prompt" && searchParams.get("login") === "ok") {
      setAffiliatePromptOpen(true);
    }
  }, [searchParams]);

  async function handleAffiliate(affiliate: boolean) {
    if (affiliate && customer) {
      try {
        await fetch("/api/customer/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ affiliate: true })
        });
        setCustomer((c) => (c ? { ...c, affiliated: true } : c));
        toast.success("¡Listo! Tu cuenta está afiliada.");
      } catch {
        toast.error("Error al afiliar");
      }
    }
    setAffiliatePromptOpen(false);
    // Limpiar query params
    const url = new URL(window.location.href);
    url.searchParams.delete("affiliate");
    url.searchParams.delete("login");
    window.history.replaceState({}, "", url.toString());
  }

  async function handleLogout() {
    await fetch("/api/customer/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    });
    setCustomer(null);
    setUserMenuOpen(false);
    toast.success("Sesión cerrada");
  }

  const close = () => setMenuOpen(false);
  const closeUserMenu = () => setUserMenuOpen(false);

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
          {/* Cuenta / Login */}
          {customer ? (
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label="Mi cuenta"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="liquid-glass h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center overflow-hidden hover:ring-2 hover:ring-gold/40 transition-all"
              >
                {customer.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customer.picture_url} alt={customer.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gold text-xs font-semibold">
                    {customer.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    {/* Overlay invisible para móvil — bloquea interacción detrás del sheet */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
                      onClick={() => setUserMenuOpen(false)}
                      aria-hidden="true"
                    />
                    {/* Móvil: bottom sheet */}
                    <motion.div
                      initial={{ opacity: 0, y: "100%" }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: "100%" }}
                      transition={{ type: "spring", damping: 30, stiffness: 280 }}
                      className="fixed bottom-0 left-0 right-0 z-[70] liquid-glass-strong rounded-t-3xl p-5 pb-8 md:hidden"
                      role="menu"
                    >
                      <div className="mx-auto w-10 h-1 rounded-full bg-ink/20 mb-4" />
                      <div className="flex items-center gap-3 pb-4 border-b border-line/40">
                        {customer.picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={customer.picture_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 grid place-items-center text-gold text-sm font-semibold shrink-0">
                            {customer.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-ink truncate">{customer.name}</p>
                          <p className="text-xs text-ink-mute truncate">{customer.email}</p>
                          {customer.affiliated && (
                            <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider text-gold border border-gold/30 bg-gold/10 rounded-full px-1.5 py-0.5">
                              ★ Afiliado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <Link href="/cuenta" onClick={closeUserMenu} role="menuitem" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors min-h-[44px]">
                          <span className="text-base">👤</span> Mi cuenta
                        </Link>
                        <Link href="/cuenta#pedidos" onClick={closeUserMenu} role="menuitem" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors min-h-[44px]">
                          <span className="text-base">📦</span> Mis pedidos
                        </Link>
                        <button onClick={handleLogout} role="menuitem" className="w-full flex items-center gap-3 mt-1 px-3 py-3 rounded-xl text-sm text-rose-300 hover:bg-rose-400/10 transition-colors min-h-[44px] text-left">
                          <span className="text-base">↪</span> Cerrar sesión
                        </button>
                      </div>
                    </motion.div>
                    {/* Desktop: dropdown anclado al avatar */}
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="hidden md:block liquid-glass-strong rounded-2xl p-3 z-[70] origin-top-right w-72"
                      style={{ position: "absolute", right: 0, top: "100%", marginTop: 8 }}
                      role="menu"
                    >
                      <div className="px-3 py-2.5 border-b border-line/40 mb-1.5">
                        <p className="text-sm font-medium text-ink truncate">{customer.name}</p>
                        <p className="text-[11px] text-ink-mute truncate">{customer.email}</p>
                        {customer.affiliated && (
                          <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider text-gold border border-gold/30 bg-gold/10 rounded-full px-1.5 py-0.5">
                            ★ Afiliado
                          </span>
                        )}
                      </div>
                      <Link href="/cuenta" onClick={closeUserMenu} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors">
                        <span>👤</span> Mi cuenta
                      </Link>
                      <Link href="/cuenta#pedidos" onClick={closeUserMenu} role="menuitem" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors">
                        <span>📦</span> Mis pedidos
                      </Link>
                      <div className="my-1 border-t border-line/30" />
                      <button onClick={handleLogout} role="menuitem" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-300 hover:bg-rose-400/10 transition-colors text-left">
                        <span>↪</span> Cerrar sesión
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href={`/api/auth/google?redirect=${encodeURIComponent(pathname || "/")}`}
              aria-label="Iniciar sesión con Google"
              className="liquid-glass h-10 sm:h-12 pl-2.5 sm:pl-3 pr-3 sm:pr-4 rounded-full inline-flex items-center gap-2 shrink-0 hover:ring-2 hover:ring-gold/40 transition-all text-xs sm:text-sm font-medium"
            >
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white grid place-items-center shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.33v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.11Z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z" fill="#34A853" />
                  <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
                </svg>
              </span>
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Link>
          )}

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
        {affiliatePromptOpen && customer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => handleAffiliate(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass-strong rounded-2xl p-6 max-w-md w-full"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 grid place-items-center mx-auto mb-3 text-2xl">
                  ★
                </div>
                <h2 className="font-display italic text-2xl text-ink">¡Hola, {customer.name.split(" ")[0]}!</h2>
                <p className="mt-2 text-sm text-ink-mute">
                  Bienvenida/o a Polianthes. ¿Quieres guardar tus datos para que tus próximas compras sean más rápidas?
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleAffiliate(true)}
                  className="w-full rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 transition-colors"
                >
                  Sí, afiliarme
                </button>
                <button
                  onClick={() => handleAffiliate(false)}
                  className="w-full rounded-full liquid-glass border border-line px-5 py-2.5 text-sm hover:border-gold/40 transition-colors"
                >
                  Ahora no
                </button>
              </div>
              <p className="mt-3 text-[10px] text-ink-mute text-center">
                Podrás afiliarte más tarde desde tu cuenta
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {!customer && (
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + (links.length + 1) * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={`/api/auth/google?redirect=${encodeURIComponent(pathname || "/")}`}
                    onClick={close}
                    className="mt-1 liquid-glass border border-line/40 rounded-xl px-4 py-3 text-sm font-medium hover:border-gold/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-white grid place-items-center shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.33v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.11Z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z" fill="#34A853" />
                        <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
                      </svg>
                    </span>
                    Iniciar sesión con Google
                  </Link>
                </motion.div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

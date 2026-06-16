"use client";
import { useEffect, useState, Suspense } from "react";
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
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label="Mi cuenta"
                className="liquid-glass h-10 w-10 sm:h-12 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0 overflow-hidden hover:ring-2 hover:ring-gold/40 transition-all"
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
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-2 w-64 liquid-glass-strong rounded-2xl p-3 z-40"
                  >
                    <div className="px-2 py-2 border-b border-line/40 mb-1">
                      <p className="text-sm font-medium text-ink truncate">{customer.name}</p>
                      <p className="text-[11px] text-ink-mute truncate">{customer.email}</p>
                      {customer.affiliated && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-gold border border-gold/30 bg-gold/10 rounded-full px-1.5 py-0.5">
                          ★ Afiliado
                        </span>
                      )}
                    </div>
                    <Link
                      href="/cuenta"
                      onClick={closeUserMenu}
                      className="block px-3 py-2 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors"
                    >
                      👤 Mi cuenta
                    </Link>
                    <Link
                      href="/cuenta#pedidos"
                      onClick={closeUserMenu}
                      className="block px-3 py-2 rounded-xl text-sm text-ink hover:bg-white/5 transition-colors"
                    >
                      📦 Mis pedidos
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left mt-1 px-3 py-2 rounded-xl text-sm text-rose-300 hover:bg-rose-400/10 transition-colors"
                    >
                      ↪ Cerrar sesión
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href={`/api/auth/google?redirect=${encodeURIComponent(pathname || "/")}`}
              aria-label="Iniciar sesión con Google"
              className="liquid-glass h-10 sm:h-12 px-3 sm:px-4 rounded-full grid place-items-center shrink-0 hover:ring-2 hover:ring-gold/40 transition-all text-xs sm:text-sm font-medium"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 11v2.6h7.3c-.3 1.8-2.2 5.4-7.3 5.4-4.4 0-8-3.6-8-8s3.6-8 8-8c2.5 0 4.2 1.1 5.1 2L19 1C17.2-.6 14.8-1.6 12-1.6 5.1-1.6-.5 4-.5 11S5.1 23 12 23c6.9 0 11.5-4.8 11.5-11.6 0-.8-.1-1.4-.2-2H12z" />
              </svg>
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
                    className="block mt-1 liquid-glass border border-line/40 rounded-xl px-4 py-3 text-sm font-medium text-center hover:border-gold/40 transition-colors"
                  >
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

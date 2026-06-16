"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const items = [
  { href: "/admin", label: "Resumen", icon: "·" },
  { href: "/admin/fragancias", label: "Fragancias", icon: "❍" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "📦" },
  { href: "/admin/promociones", label: "Promociones", icon: "🎁" },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "📈" },
  { href: "/admin/resenas", label: "Reseñas", icon: "★" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/admin/envio", label: "Envíos", icon: "🚚" },
  { href: "/admin/pagos", label: "Pagos", icon: "💳" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "🔔" },
  { href: "/admin/menu", label: "Menús", icon: "☰" },
  { href: "/admin/seguridad", label: "Seguridad", icon: "🔐" }
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors min-h-[44px] ${
              active ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
            }`}
          >
            <span className="text-base shrink-0">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth?action=logout" method="POST" className="mt-auto px-3">
      <button
        type="submit"
        className="text-xs text-ink-mute hover:text-gold min-h-[44px] flex items-center"
        onClick={async (e) => {
          e.preventDefault();
          await fetch("/api/auth?action=logout", { method: "POST" });
          window.location.href = "/admin";
        }}
      >
        Cerrar sesión
      </button>
    </form>
  );
}

export default function AdminSidebar({ username }: { username?: string | null }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* === Botón hamburguesa fijo (solo móvil) === */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 liquid-glass-strong rounded-full w-11 h-11 grid place-items-center shrink-0"
        aria-label="Abrir menú de navegación"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* === Drawer overlay (solo móvil) === */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-bg-elev border-r border-line flex flex-col py-6 pr-3 pl-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img
                    src="/brand/Isotipo-Blanco.png"
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                  <p className="font-display italic text-2xl text-ink">Panel</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="liquid-glass rounded-full w-9 h-9 grid place-items-center shrink-0"
                  aria-label="Cerrar menú"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {username && <p className="text-xs text-ink-mute mb-4">Sesión: {username}</p>}
              <div className="flex-1 overflow-y-auto">
                <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <LogoutButton />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* === Sidebar fijo (solo desktop) === */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-line min-h-[calc(100vh-7rem)] py-8 pr-4">
        <div className="flex items-center gap-2 px-3">
          <img
            src="/brand/Isotipo-Blanco.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <p className="font-display italic text-2xl text-ink">Panel</p>
        </div>
        {username && <p className="text-xs text-ink-mute px-3 mt-1">Sesión: {username}</p>}
        <div className="mt-8 flex-1">
          <NavLinks pathname={pathname} />
        </div>
        <LogoutButton />
      </aside>
    </>
  );
}

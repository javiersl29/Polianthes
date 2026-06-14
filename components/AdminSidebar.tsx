"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Resumen", icon: "·" },
  { href: "/admin/fragancias", label: "Fragancias", icon: "❍" },
  { href: "/admin/imagenes", label: "Imágenes con IA", icon: "🖼" },
  { href: "/admin/precios", label: "Precios e inventario", icon: "$" },
  { href: "/admin/nombres", label: "Nombres artísticos", icon: "✦" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "📦" },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "📈" },
  { href: "/admin/resenas", label: "Reseñas", icon: "★" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/admin/envio", label: "Envíos", icon: "🚚" },
  { href: "/admin/pagos", label: "Pagos", icon: "💳" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "🔔" },
  { href: "/admin/menu", label: "Menús", icon: "☰" }
];

export default function AdminSidebar({ username }: { username?: string | null }) {
  const pathname = usePathname();
  return (
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
      <nav className="mt-8 flex flex-col gap-1">
        {items.map((it) => {
          const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors ${
                active ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
              }`}
            >
              <span className="text-base">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <form action="/api/auth?action=logout" method="POST" className="mt-auto px-3">
        <button
          type="submit"
          className="text-xs text-ink-mute hover:text-gold"
          onClick={async (e) => {
            e.preventDefault();
            await fetch("/api/auth?action=logout", { method: "POST" });
            window.location.href = "/admin";
          }}
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}

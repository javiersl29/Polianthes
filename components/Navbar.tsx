"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/#decodificador", label: "Decodificador" },
  { href: "/#capacidades", label: "Capacidades" },
  { href: "/#catalogo", label: "Catálogo" }
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4 lg:px-8 flex items-center justify-between">
      <Link
        href="/"
        aria-label="Polianthes"
        className="liquid-glass h-12 w-12 rounded-full grid place-items-center text-2xl font-display italic text-gold"
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

      <span className="h-12 w-12 hidden md:block" aria-hidden="true" />
    </header>
  );
}

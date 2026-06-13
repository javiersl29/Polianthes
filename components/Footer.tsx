"use client";
import { useEffect, useState } from "react";

type NavLink = {
  id: number;
  label: string;
  href: string;
  new_tab: boolean;
};

export default function Footer() {
  const [links, setLinks] = useState<NavLink[]>([
    { id: 1, label: "Panel", href: "/admin", new_tab: false },
    { id: 2, label: "Código", href: "https://github.com/javiersl29/Polianthes", new_tab: true }
  ]);

  useEffect(() => {
    fetch("/api/public/nav?location=footer")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.links?.length > 0) setLinks(data.links);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-line mt-20 sm:mt-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src="/brand/Isotipo-Blanco.png"
              alt=""
              width={48}
              height={48}
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain shrink-0"
            />
            <div>
              <img
                src="/brand/Logo-Blanco.png"
                alt="Polianthes"
                width={180}
                height={60}
                className="h-9 sm:h-10 w-auto"
              />
              <p className="mt-1 max-w-sm text-sm text-ink-mute">Perfumería de autor. Curaduría, decodificación y asesoría olfativa en un solo lugar.</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm text-ink-mute flex-wrap">
            {links.map((l) => (
              <a
                key={l.id}
                href={l.href}
                target={l.new_tab ? "_blank" : undefined}
                rel={l.new_tab ? "noopener noreferrer" : undefined}
                className="hover:text-gold transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-6 pt-4 border-t border-line/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-mute/60">
          <p>Polianthes &copy; {new Date().getFullYear()}</p>
          <p>Curaduría de perfumería de autor</p>
        </div>
        <p className="mt-3 text-[10px] text-ink-mute/50 text-center max-w-3xl mx-auto leading-relaxed">
          Polianthes interpreta composiciones olfativas. Las fragancias Polianthes no están afiliadas, patrocinadas ni respaldadas por las casas mencionadas. Los nombres y descripciones son referencias culturales y olfativas.
        </p>
      </div>
    </footer>
  );
}

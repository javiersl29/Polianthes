"use client";

type FooterLink = { label: string; href: string };

const TIENDA_LINKS: FooterLink[] = [
  { label: "Catálogo", href: "/#catalogo" },
  { label: "Decodificador", href: "/#decodificador" },
  { label: "Mi cuenta", href: "/cuenta" },
  { label: "Mis pedidos", href: "/cuenta#pedidos" }
];

const AYUDA_LINKS: FooterLink[] = [
  { label: "Envíos y entregas", href: "mailto:ventas@polianthes.shop?subject=Envíos%20y%20entregas" },
  { label: "Tamaños y presentaciones", href: "mailto:ventas@polianthes.shop?subject=Tamaños%20y%20presentaciones" },
  { label: "Devoluciones", href: "mailto:ventas@polianthes.shop?subject=Devoluciones" },
  { label: "Contacto", href: "mailto:ventas@polianthes.shop" }
];

export default function Footer() {
  return (
    <footer className="relative mt-20 sm:mt-32 border-t border-line/60">
      {/* Glow superior */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 rounded-full bg-gold/10 blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Sección principal: logo + columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <img src="/brand/Isotipo-Blanco.png" alt="Polianthes" width={48} height={48} className="h-12 w-12 object-contain shrink-0" />
            <p className="mt-4 text-sm text-ink-mute leading-relaxed max-w-xs">
              Perfumes de inspiración. Decodificamos las fragancias icónicas del mundo y las reinterpretamos para ti.
            </p>
            <a
              href="mailto:ventas@polianthes.shop"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold/80 hover:text-gold transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              ventas@polianthes.shop
            </a>
          </div>

          {/* Tienda */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-gold/70 font-semibold mb-3">Tienda</h3>
            <ul className="space-y-2">
              {TIENDA_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-ink-mute hover:text-gold transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Ayuda */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-gold/70 font-semibold mb-3">Ayuda</h3>
            <ul className="space-y-2">
              {AYUDA_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-ink-mute hover:text-gold transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Presentaciones / Info */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-gold/70 font-semibold mb-3">Presentaciones</h3>
            <ul className="space-y-1.5 text-sm text-ink-mute">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold/50" /> 10 ml — Travel
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold/50" /> 30 ml — Estandar
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold/50" /> 60 ml — Grande
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold/50" /> 100 ml — Coleccionista
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-mute/60">Envíos a todo México · Pago seguro</p>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="mt-8 pt-5 border-t border-line/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-ink-mute/50">
          <p>Polianthes &copy; {new Date().getFullYear()} · Perfumería de inspiración</p>
          <p className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Pagos seguros con Mercado Pago
          </p>
        </div>

        {/* Disclaimer legal */}
        <p className="mt-5 text-[10px] text-ink-mute/40 text-center max-w-3xl mx-auto leading-relaxed">
          Polianthes crea perfumes inspirados en fragancias icónicas. No estamos afiliados, patrocinados ni asociados con las marcas originales mencionadas. Los nombres de las fragancias originales son propiedad de sus respectivos titulares y se mencionan únicamente como referencia olfativa comparativa.
        </p>
      </div>
    </footer>
  );
}


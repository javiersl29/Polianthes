export default function Footer() {
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
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-ink-mute">
            <a href="/admin" className="hover:text-gold transition-colors">Panel</a>
            <span className="text-line">·</span>
            <a href="https://github.com/javiersl29/Polianthes" className="hover:text-gold transition-colors">Código</a>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-line/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-mute/60">
          <p>Polianthes &copy; {new Date().getFullYear()}</p>
          <p>Curaduría de perfumería de autor</p>
        </div>
      </div>
    </footer>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-line mt-32">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-ink-mute">
        <div>
          <p className="font-display italic text-2xl text-gold">Polianthes</p>
          <p className="mt-1 max-w-sm">Perfumería de autor. Curaduría, decodificación y asesoría olfativa en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-6">
          <a href="/admin" className="hover:text-gold">Panel</a>
          <a href="https://github.com/javiersl29/Polianthes" className="hover:text-gold">Código</a>
        </div>
      </div>
    </footer>
  );
}

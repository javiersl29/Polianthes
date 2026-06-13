import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CheckoutFailedPage({ searchParams }: { searchParams: { order?: string } }) {
  return (
    <main className="pt-32 pb-20 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-rose-400/15 border border-rose-300/30 grid place-items-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-300"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </div>
        <h1 className="mt-6 font-display italic text-4xl sm:text-5xl text-ink">No se pudo procesar el pago</h1>
        <p className="mt-3 text-ink-mute">
          Tu pago fue rechazado o cancelado. Puedes intentarlo de nuevo. Si crees que es un error,
          escríbenos y te ayudaremos.
        </p>
        {searchParams.order && (
          <p className="mt-4 text-xs text-gold/70 font-mono">Orden {searchParams.order}</p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#catalogo"
            className="rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90"
          >
            Volver al catálogo
          </Link>
          <Link
            href="/"
            className="rounded-full liquid-glass border border-line px-6 py-3 text-sm hover:border-gold/40"
          >
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

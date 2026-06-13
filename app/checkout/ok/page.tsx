import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CheckoutOkPage({ searchParams }: { searchParams: { order?: string } }) {
  const publicId = searchParams.order;
  return (
    <main className="pt-32 pb-20 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-400/15 border border-emerald-300/30 grid place-items-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="mt-6 font-display italic text-4xl sm:text-5xl text-ink">¡Gracias por tu compra!</h1>
        <p className="mt-3 text-ink-mute">
          Recibimos tu pago y estamos preparando tu pedido. Te llegará una confirmación por correo.
        </p>
        {publicId && (
          <p className="mt-4 text-xs text-gold/70 font-mono">Orden {publicId}</p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#catalogo"
            className="rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium hover:bg-gold/90"
          >
            Seguir explorando
          </Link>
          <Link
            href="/"
            className="rounded-full liquid-glass border border-line px-6 py-3 text-sm hover:border-gold/40"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

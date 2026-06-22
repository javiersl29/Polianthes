"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/admin";

  const googleHref = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <div className="mt-8 liquid-glass rounded-3xl p-6 sm:p-8 space-y-5">
      <div className="text-center space-y-2">
        <p className="font-display italic text-xl text-ink">Acceso con Google</p>
        <p className="text-xs text-ink-mute">
          El panel solo está disponible mediante autenticación con Google.
        </p>
      </div>

      <a
        href={googleHref}
        className="liquid-glass-strong rounded-full w-full flex items-center justify-center gap-3 py-3.5 text-sm font-medium hover:ring-2 hover:ring-gold/40 transition-all"
      >
        <span className="w-5 h-5 rounded-full bg-white grid place-items-center shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.33v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.11Z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z" fill="#34A853" />
            <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
          </svg>
        </span>
        Continuar con Google
      </a>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-ink-mute/70">
        <div className="flex-1 h-px bg-line/40" />
        <span>Solo el correo autorizado</span>
        <div className="flex-1 h-px bg-line/40" />
      </div>

      <p className="text-[11px] text-ink-mute text-center leading-relaxed">
        Solo la cuenta de Google configurada como administrador puede acceder al panel.
        Si necesitas acceso, contacta al propietario.
      </p>
    </div>
  );
}
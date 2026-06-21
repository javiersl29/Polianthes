"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Mode = "login" | "register";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Falta el token de verificación.",
  invalid_or_expired: "El enlace no es válido o ha expirado. Solicita uno nuevo.",
  invalid_token: "El enlace no es válido o ha expirado."
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as Mode) ?? "login";
  const redirectParam = searchParams.get("redirect") ?? "/cuenta";
  const errorParam = searchParams.get("error");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const googleHref = `/api/auth/google?redirect=${encodeURIComponent(redirectParam)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        const r = await fetch("/api/customer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error al registrarse");
        toast.success(data.message ?? "Cuenta creada");
        router.push(redirectParam);
        router.refresh();
      } else {
        const r = await fetch("/api/customer/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error al iniciar sesión");
        toast.success(`Bienvenido, ${data.customer.name}`);
        router.push(redirectParam);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-display italic text-4xl text-gold">Polianthes</h1>
          </Link>
          <p className="mt-2 text-sm text-ink-mute">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </p>
        </div>

        {errorParam && (
          <div className="mb-6 liquid-glass rounded-2xl p-4 border-l-4 border-rose-400/60 bg-rose-400/5">
            <p className="text-sm text-rose-200">
              {ERROR_MESSAGES[errorParam] ?? "Hubo un problema. Intenta de nuevo."}
            </p>
          </div>
        )}

        {/* Tabs login/register */}
        <div className="liquid-glass rounded-full p-1 flex mb-6">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
              mode === "login" ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
              mode === "register" ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Google */}
        <a
          href={googleHref}
          className="liquid-glass rounded-full w-full flex items-center justify-center gap-3 py-3 text-sm font-medium hover:ring-2 hover:ring-gold/40 transition-all mb-6"
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

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-line/40" />
          <span className="text-[11px] uppercase tracking-wider text-ink-mute">o con tu correo</span>
          <div className="flex-1 h-px bg-line/40" />
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-gold"
                placeholder="Tu nombre"
                required
                minLength={2}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-gold"
              placeholder="tucorreo@email.com"
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-gold"
              placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
              required
              minLength={mode === "register" ? 6 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          {mode === "login" && (
            <div className="text-right">
              <Link
                href="/recuperar"
                className="text-xs text-ink-mute hover:text-gold transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gold text-bg py-3 text-sm font-bold hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Procesando…"
              : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>

        {mode === "register" && (
          <p className="mt-4 text-[11px] text-ink-mute text-center leading-relaxed">
            Al crear tu cuenta, te enviaremos un correo de confirmación
            para verificar tu dirección de email.
          </p>
        )}

        {/* Switch */}
        <p className="mt-6 text-center text-sm text-ink-mute">
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-gold hover:underline font-medium"
              >
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-gold hover:underline font-medium"
              >
                Inicia sesión
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

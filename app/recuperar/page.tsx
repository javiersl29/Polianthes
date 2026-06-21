"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function RecoverPage() {
  return (
    <Suspense fallback={null}>
      <RecoverInner />
    </Suspense>
  );
}

function RecoverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"request" | "reset" | "done">(tokenParam ? "reset" : "request");

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(data.message ?? "Revisa tu correo");
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenParam, password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Contraseña restablecida");
      router.push("/login?mode=login");
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
          <p className="mt-2 text-sm text-ink-mute">Recuperar contraseña</p>
        </div>

        {step === "request" && (
          <form onSubmit={requestReset} className="space-y-4">
            <p className="text-sm text-ink-mute text-center mb-6">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gold text-bg py-3 text-sm font-bold hover:bg-gold/90 disabled:opacity-50"
            >
              {loading ? "Enviando…" : "Enviar enlace"}
            </button>
            <p className="text-center text-sm">
              <Link href="/login" className="text-ink-mute hover:text-gold transition-colors">
                ← Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={doReset} className="space-y-4">
            <p className="text-sm text-ink-mute text-center mb-6">
              Ingresa tu nueva contraseña.
            </p>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Nueva contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-gold"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoComplete="new-password"
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gold text-bg py-3 text-sm font-bold hover:bg-gold/90 disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Restablecer contraseña"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="liquid-glass rounded-2xl p-8">
              <p className="text-3xl mb-4">✓</p>
              <h2 className="font-display italic text-2xl text-ink mb-2">Revisa tu correo</h2>
              <p className="text-sm text-ink-mute">
                Si el correo existe en nuestra base de datos, recibirás un enlace
                para restablecer tu contraseña en breve.
              </p>
            </div>
            <p className="mt-6">
              <Link href="/login" className="text-gold hover:underline text-sm">
                ← Volver a iniciar sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

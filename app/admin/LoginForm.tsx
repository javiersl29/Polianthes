"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = password, 2 = TOTP
  const codeRef = useRef<HTMLInputElement>(null);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error");
        return;
      }
      // Si el servidor dice que necesita 2FA, cambiar al paso 2
      if (data.needs_2fa) {
        setStep(2);
        setTimeout(() => codeRef.current?.focus(), 100);
      } else {
        // Login completo sin 2FA
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const submitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth?action=verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Código incorrecto");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const backToStep1 = () => {
    setStep(1);
    setTotpCode("");
    setError(null);
  };

  // === Paso 1: usuario + contraseña ===
  if (step === 1) {
    return (
      <form onSubmit={submitPassword} className="mt-8 liquid-glass rounded-3xl p-6 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink-mute">Usuario</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink-mute">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
          />
        </label>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button
          disabled={loading}
          className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium hover:text-gold transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    );
  }

  // === Paso 2: código TOTP ===
  return (
    <form onSubmit={submitTotp} className="mt-8 liquid-glass rounded-3xl p-6 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm text-ink-mute">// Paso 2 de 2</p>
        <p className="font-display italic text-2xl text-ink">Código de verificación</p>
        <p className="text-xs text-ink-mute mt-2">
          Abre Google Authenticator (o Authy/1Password) e ingresa el código de 6 dígitos.
        </p>
      </div>
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink-mute">Código de 6 dígitos</span>
        <input
          ref={codeRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="mt-1 w-full bg-transparent border-b border-line py-3 outline-none focus:border-gold font-mono text-center text-2xl tracking-[0.5em]"
        />
      </label>
      {error && <p className="text-sm text-rose-300 text-center">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={backToStep1}
          className="liquid-glass rounded-full px-4 py-2.5 text-sm text-ink-mute hover:text-gold"
        >
          ← Volver
        </button>
        <button
          disabled={loading || totpCode.length !== 6}
          className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium hover:text-gold transition-colors disabled:opacity-50"
        >
          {loading ? "Verificando…" : "Verificar"}
        </button>
      </div>
    </form>
  );
}

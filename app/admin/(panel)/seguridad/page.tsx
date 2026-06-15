"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function TwoFactorPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup state
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // Disable state
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/2fa")
      .then(r => r.json())
      .then(d => {
        setEnabled(d.enabled ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const startSetup = async () => {
    setSetupLoading(true);
    try {
      const r = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      setQrUrl(d.qr_data_url);
      setSecret(d.manual_entry);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSetupLoading(false);
    }
  };

  const confirmSetup = async () => {
    if (!setupCode.trim()) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }
    setSetupLoading(true);
    try {
      const r = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code: setupCode.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      toast.success("2FA activado correctamente");
      setEnabled(true);
      setQrUrl(null);
      setSecret(null);
      setSetupCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSetupLoading(false);
    }
  };

  const disable = async () => {
    if (!disableCode.trim()) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }
    setDisableLoading(true);
    try {
      const r = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: disableCode.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error");
      toast.success("2FA desactivado");
      setEnabled(false);
      setDisableCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setDisableLoading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-mute">Cargando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gold/80 uppercase tracking-wider">// Seguridad</p>
        <h1 className="font-display italic text-3xl sm:text-4xl text-ink mt-1">
          Autenticación de dos pasos
        </h1>
        <p className="text-sm text-ink-mute mt-2 max-w-xl">
          Protege tu panel admin con una capa adicional de seguridad. Cada vez que inicies sesión,
          además de tu contraseña necesitarás un código de 6 dígitos generado por tu app
          (Google Authenticator, Authy, 1Password).
        </p>
      </div>

      {/* === Estado actual === */}
      <div className="liquid-glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              enabled ? "badge-ok" : "badge-warn"
            }`}
          >
            {enabled ? "✔ Activado" : "⚠ No activado"}
          </span>
          <p className="text-sm text-ink-mute">
            {enabled
              ? "Tu cuenta requiere código TOTP en cada login."
              : "Tu cuenta solo usa contraseña. Te recomendamos activar 2FA."}
          </p>
        </div>
      </div>

      {/* === Activar 2FA (si no está activado) === */}
      {!enabled && !qrUrl && (
        <div className="liquid-glass rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-medium text-ink mb-3">Paso 1: Generar código QR</p>
          <button
            onClick={startSetup}
            disabled={setupLoading}
            className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm hover:text-gold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {setupLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                Generando…
              </>
            ) : (
              "Generar código QR"
            )}
          </button>
        </div>
      )}

      {/* === QR + confirmación === */}
      {qrUrl && (
        <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-4">
          <p className="text-sm font-medium text-ink">Paso 2: Escanea este QR</p>
          <div className="bg-white rounded-xl p-3 inline-block mx-auto">
            <img src={qrUrl} alt="QR code para Google Authenticator" width={200} height={200} />
          </div>
          {secret && (
            <div>
              <p className="text-[11px] text-ink-mute mb-1">
                ¿No puedes escanear? Ingresa manualmente este código:
              </p>
              <code className="text-xs text-gold bg-black/40 px-3 py-1.5 rounded-lg font-mono tracking-wider break-all">
                {secret}
              </code>
            </div>
          )}
          <div className="border-t border-line/30 pt-4">
            <p className="text-sm font-medium text-ink mb-2">
              Paso 3: Ingresa el código de tu app
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="field-input font-mono text-center text-lg tracking-[0.5em] w-40"
              />
              <button
                onClick={confirmSetup}
                disabled={setupLoading || setupCode.length !== 6}
                className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm hover:text-gold disabled:opacity-50"
              >
                {setupLoading ? "Verificando…" : "Activar 2FA"}
              </button>
            </div>
            <p className="text-[11px] text-ink-mute mt-2">
              Abre Google Authenticator, toca &quot;+&quot; → &quot;Escanear código QR&quot;.
              El código cambia cada 30 segundos.
            </p>
          </div>
        </div>
      )}

      {/* === Desactivar 2FA (si está activado) === */}
      {enabled && (
        <div className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
          <p className="text-sm font-medium text-ink">Desactivar 2FA</p>
          <p className="text-[11px] text-ink-mute">
            Ingresa un código actual de tu app para confirmar la desactivación.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="field-input font-mono text-center text-lg tracking-[0.5em] w-40"
            />
            <button
              onClick={disable}
              disabled={disableLoading || disableCode.length !== 6}
              className="liquid-glass rounded-full px-5 py-2.5 text-sm text-rose-300 hover:text-rose-200 disabled:opacity-50"
            >
              {disableLoading ? "Desactivando…" : "Desactivar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

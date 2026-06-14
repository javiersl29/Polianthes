"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Config = {
  id: number;
  provider: "resend" | "smtp" | "none";
  from_email: string;
  from_name: string;
  resend_api_key: string | null;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_secure: boolean;
  active: boolean;
};

export default function AdminEmailPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [provider, setProvider] = useState<"resend" | "smtp" | "none">("resend");
  const [fromEmail, setFromEmail] = useState("noreply@polianthes.mx");
  const [fromName, setFromName] = useState("Polianthes");
  const [resendKey, setResendKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [active, setActive] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/email");
      const data = await r.json();
      const c = data.config;
      if (c) {
        setProvider(c.provider ?? "resend");
        setFromEmail(c.from_email ?? "noreply@polianthes.mx");
        setFromName(c.from_name ?? "Polianthes");
        setResendKey(""); // siempre vacío (no pre-llenar el enmascarado)
        setSmtpHost(c.smtp_host ?? "");
        setSmtpPort(c.smtp_port ?? 587);
        setSmtpUser(c.smtp_user ?? "");
        setSmtpSecure(c.smtp_secure ?? true);
        setActive(c.active ?? false);
        setConfig(c);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider,
        from_email: fromEmail,
        from_name: fromName,
        smtp_host: smtpHost || null,
        smtp_port: smtpPort,
        smtp_user: smtpUser || null,
        smtp_secure: smtpSecure,
        active
      };
      if (resendKey.trim()) body.resend_api_key = resendKey.trim();
      if (smtpPassword.trim()) body.smtp_password = smtpPassword.trim();

      const r = await fetch("/api/admin/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Configuración de email guardada");
      setResendKey("");
      setSmtpPassword("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testEmail.trim()) {
      toast.error("Escribe un email para la prueba");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/admin/email/test?email=${encodeURIComponent(testEmail)}`);
      const data = await r.json();
      setTestResult({ ok: !!data.ok, message: data.message ?? (data.ok ? "Enviado" : "Error") });
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Error" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="mt-8 text-sm text-ink-mute">Cargando…</p>;

  return (
    <div>
      <p className="text-sm text-ink-mute">// Email</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Correos automáticos</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Configura el envío automático de correos de confirmación a tus clientes cuando completan una compra.
        Recomendamos <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-gold underline">Resend</a> (gratis hasta 3,000 emails/mes).
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Provider */}
          <div className="liquid-glass rounded-2xl p-5 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-4">Proveedor</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { v: "resend", label: "📧 Resend", desc: "Recomendado" },
                { v: "smtp", label: "📬 SMTP", desc: "Gmail, Outlook, etc." },
                { v: "none", label: "🚫 Desactivado", desc: "Sin emails" }
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setProvider(opt.v)}
                  className={`rounded-xl px-3 py-3 text-sm border transition-colors ${
                    provider === opt.v
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line/40 text-ink/60 hover:text-ink"
                  }`}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Campos comunes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Nombre del remitente</span>
                <input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="Polianthes"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Email del remitente</span>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="noreply@polianthes.mx"
                />
              </label>
            </div>

            {/* Resend config */}
            {provider === "resend" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Resend API Key</span>
                <input
                  type="password"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                  placeholder="re_XXXXXXXXXXXXXXXX"
                  autoComplete="off"
                />
                {config?.resend_api_key && (
                  <p className="mt-1 text-[10px] text-ink-mute">
                    Actual: {config.resend_api_key} <span className="text-gold/40">(dejar vacío para mantener)</span>
                  </p>
                )}
                <p className="mt-2 text-[11px] text-ink-mute">
                  <strong>¿Cómo conseguir tu API Key?</strong><br />
                  1. Crea cuenta gratis en <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-gold underline">resend.com</a><br />
                  2. Ve a <strong>API Keys</strong> → <strong>"Create API Key"</strong><br />
                  3. Copia la clave (empieza con <code className="text-gold">re_</code>)<br />
                  4. Pécala aquí y guarda<br />
                  5. <strong>Importante:</strong> en Resend, verifica tu dominio o usa <code className="text-gold">onboarding@resend.dev</code> como remitente para pruebas
                </p>
              </label>
            )}

            {/* SMTP config */}
            {provider === "smtp" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">SMTP Host</span>
                    <input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder="smtp.gmail.com"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Puerto</span>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder="587"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Usuario</span>
                    <input
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder="tu@gmail.com"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Contraseña</span>
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                      placeholder="(dejar vacío para mantener)"
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="accent-[color:var(--color-gold)]"
                  />
                  Usar conexión segura (TLS/SSL)
                </label>
              </div>
            )}

            {/* Activo */}
            <div className="mt-4 pt-4 border-t border-line">
              <button
                onClick={() => setActive(!active)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                  active
                    ? "bg-emerald-400/10 border-emerald-300/30 text-emerald-300"
                    : "border-white/10 text-ink-mute hover:text-ink"
                }`}
              >
                {active ? "✓ Emails activos (se envían al cliente)" : "Emails desactivados (no se envían)"}
              </button>
            </div>
          </div>

          {/* Botón guardar */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
            <span className="text-xs text-ink-mute">
              {config?.active ? "Emails activos ✓" : "Emails desactivados"}
            </span>
          </div>
        </div>

        {/* Test panel */}
        <div className="space-y-4">
          <div className="liquid-glass rounded-2xl p-5">
            <h2 className="font-display italic text-xl text-ink mb-3">Probar envío</h2>
            <p className="text-xs text-ink-mute mb-3">
              Envía un email de prueba para verificar que la configuración funcione.
            </p>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Email destino</span>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                placeholder="tu@email.com"
              />
            </label>
            <button
              onClick={sendTest}
              disabled={testing || !testEmail.trim()}
              className="mt-3 w-full rounded-full liquid-glass border border-line px-4 py-2.5 text-sm hover:border-gold/40 disabled:opacity-50"
            >
              {testing ? "Enviando…" : "Enviar email de prueba"}
            </button>
            {testResult && (
              <p className={`mt-3 text-xs ${testResult.ok ? "text-emerald-300" : "text-rose-300"}`}>
                {testResult.ok ? "✓" : "✕"} {testResult.message}
              </p>
            )}
          </div>

          <div className="liquid-glass rounded-2xl p-4 text-xs text-ink-mute">
            <p className="font-medium text-ink mb-2">¿Cuándo se envían emails?</p>
            <ul className="space-y-1">
              <li>✓ Cuando un cliente completa un pago aprobado en el checkout</li>
              <li>✓ El email incluye: items, total, dirección de entrega, número de pedido</li>
              <li>✓ Si el email falla, el pago sigue funcionando (no se bloquea)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

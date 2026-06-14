"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Config = {
  provider: "resend" | "smtp" | "none";
  from_email: string;
  from_name: string;
  resend_api_key: string | null;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_secure: boolean;
  active: boolean;
  admin_email: string | null;
  notify_admin_new_order: boolean;
  notify_customer_confirmation: boolean;
  notify_customer_shipped: boolean;
};

export default function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provider, setProvider] = useState<"resend" | "smtp" | "none">("resend");
  const [fromEmail, setFromEmail] = useState("onboarding@resend.dev");
  const [fromName, setFromName] = useState("Polianthes");
  const [resendKey, setResendKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [active, setActive] = useState(false);

  // Notificaciones
  const [adminEmail, setAdminEmail] = useState("");
  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [notifyShipped, setNotifyShipped] = useState(true);

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [currentKey, setCurrentKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/email");
      const data = await r.json();
      const c = data.config;
      if (c) {
        setProvider(c.provider ?? "resend");
        setFromEmail(c.from_email ?? "onboarding@resend.dev");
        setFromName(c.from_name ?? "Polianthes");
        setCurrentKey(c.resend_api_key ?? null);
        setSmtpHost(c.smtp_host ?? "");
        setSmtpPort(c.smtp_port ?? 587);
        setSmtpUser(c.smtp_user ?? "");
        setSmtpSecure(c.smtp_secure ?? true);
        setActive(c.active ?? false);
        setAdminEmail(c.admin_email ?? "");
        setNotifyAdmin(c.notify_admin_new_order ?? true);
        setNotifyCustomer(c.notify_customer_confirmation ?? true);
        setNotifyShipped(c.notify_customer_shipped ?? true);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider, from_email: fromEmail, from_name: fromName,
        smtp_host: smtpHost || null, smtp_port: smtpPort,
        smtp_user: smtpUser || null, smtp_secure: smtpSecure,
        active, admin_email: adminEmail,
        notify_admin_new_order: notifyAdmin,
        notify_customer_confirmation: notifyCustomer,
        notify_customer_shipped: notifyShipped
      };
      if (resendKey.trim()) body.resend_api_key = resendKey.trim();
      if (smtpPassword.trim()) body.smtp_password = smtpPassword.trim();

      const r = await fetch("/api/admin/email", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Configuración guardada");
      setResendKey(""); setSmtpPassword("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSaving(false); }
  }

  async function sendTest() {
    if (!testEmail.trim()) { toast.error("Escribe un email"); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`/api/admin/email/test?email=${encodeURIComponent(testEmail)}`);
      const data = await r.json();
      setTestResult({ ok: !!data.ok, message: data.message ?? "" });
      if (data.ok) toast.success(data.message); else toast.error(data.message);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Error" });
    } finally { setTesting(false); }
  }

  if (loading) return <p className="mt-8 text-sm text-ink-mute">Cargando…</p>;

  return (
    <div>
      <p className="text-sm text-ink-mute">// Notificaciones</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Notificaciones</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Configura emails automáticos para tus clientes y para ti. Recomendamos{" "}
        <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-gold underline">Resend</a> (gratis hasta 3,000/mes).
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Proveedor */}
          <section className="liquid-glass rounded-2xl p-5 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-4">Proveedor de email</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { v: "resend" as const, label: "📧 Resend", desc: "Recomendado" },
                { v: "smtp" as const, label: "📬 SMTP", desc: "Gmail, etc." },
                { v: "none" as const, label: "🚫 Desactivado", desc: "Sin emails" }
              ]).map((opt) => (
                <button key={opt.v} onClick={() => setProvider(opt.v)}
                  className={`rounded-xl px-3 py-3 text-sm border transition-colors ${provider === opt.v ? "border-gold bg-gold/10 text-gold" : "border-line/40 text-ink/60 hover:text-ink"}`}>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Nombre remitente</span>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Email remitente</span>
                <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="onboarding@resend.dev" />
              </label>
            </div>

            {provider === "resend" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Resend API Key</span>
                <input type="password" value={resendKey} onChange={(e) => setResendKey(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono" placeholder="re_XXXXXXXX" autoComplete="off" />
                {currentKey && <p className="mt-1 text-[10px] text-ink-mute">Actual: {currentKey} <span className="text-gold/40">(dejar vacío para mantener)</span></p>}
                <div className="mt-2 p-3 rounded-lg bg-black/30 text-[11px] text-ink-mute space-y-1">
                  <p className="text-gold/80 font-medium">¿Cómo configurar Resend?</p>
                  <p>1. Crea cuenta en <a href="https://resend.com" target="_blank" className="text-gold underline">resend.com</a></p>
                  <p>2. API Keys → "Create API Key" → copia <code className="text-gold">re_...</code></p>
                  <p>3. Para pruebas usa <code className="text-gold">onboarding@resend.dev</code> como remitente</p>
                  <p>4. Para producción: verifica tu dominio en Resend → DNS</p>
                  <p className="text-amber-300/70">⚠ Plan free: sólo envía al email de tu cuenta de Resend. Para enviar a cualquier cliente, verifica tu dominio.</p>
                </div>
              </label>
            )}

            {provider === "smtp" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">SMTP Host</span>
                    <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="smtp.gmail.com" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Puerto</span>
                    <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Usuario</span>
                    <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider text-gold/80">Contraseña</span>
                    <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" autoComplete="off" />
                  </label>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-line">
              <button onClick={() => setActive(!active)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${active ? "bg-emerald-400/10 border-emerald-300/30 text-emerald-300" : "border-white/10 text-ink-mute hover:text-ink"}`}>
                {active ? "✓ Notificaciones activas" : "Notificaciones desactivadas"}
              </button>
            </div>
          </section>

          {/* Notificaciones */}
          <section className="liquid-glass rounded-2xl p-5 sm:p-6">
            <h2 className="font-display italic text-xl text-ink mb-4">¿Qué notificar?</h2>

            {/* Admin */}
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-2">🔔 Al administrador</p>
              <label className="block mb-3">
                <span className="text-[11px] text-ink-mute">Tu email para recibir notificaciones</span>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="ventas@polianthes.mx" />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer mb-2">
                <input type="checkbox" checked={notifyAdmin} onChange={(e) => setNotifyAdmin(e.target.checked)} className="accent-[color:var(--color-gold)]" />
                🛎 Nuevo pedido recibido (con items, total, datos del cliente)
              </label>
            </div>

            {/* Cliente */}
            <div className="pt-4 border-t border-line">
              <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-2">📦 Al cliente</p>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer mb-2">
                <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} className="accent-[color:var(--color-gold)]" />
                ✅ Confirmación de pago (con detalles del pedido y entrega)
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={notifyShipped} onChange={(e) => setNotifyShipped(e.target.checked)} className="accent-[color:var(--color-gold)]" />
                📦 Pedido enviado (con número de guía)
              </label>
            </div>
          </section>

          <button onClick={save} disabled={saving}
            className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>

        {/* Test */}
        <div className="space-y-4">
          <div className="liquid-glass rounded-2xl p-5">
            <h2 className="font-display italic text-xl text-ink mb-3">Probar envío</h2>
            <p className="text-xs text-ink-mute mb-3">Verifica que la configuración funcione.</p>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Email destino</span>
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" placeholder="tu@email.com" />
            </label>
            <button onClick={sendTest} disabled={testing || !testEmail.trim()}
              className="mt-3 w-full rounded-full liquid-glass border border-line px-4 py-2.5 text-sm hover:border-gold/40 disabled:opacity-50">
              {testing ? "Enviando…" : "🔔 Enviar prueba"}
            </button>
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                {testResult.ok ? "✓" : "✕"} {testResult.message}
              </div>
            )}
          </div>

          <div className="liquid-glass rounded-2xl p-4 text-xs text-ink-mute space-y-2">
            <p className="font-medium text-ink">Resumen del flujo</p>
            <p>📦 Cliente paga → ✉ confirmación al cliente + 🛎 notificación al admin</p>
            <p>🚚 Admin marca "en tránsito" → ✉ email al cliente con guía</p>
            <p className="text-amber-300/60">⚠ Plan free de Resend: sólo envía al email de TU cuenta. Para enviar a cualquier cliente, verifica tu dominio en Resend.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

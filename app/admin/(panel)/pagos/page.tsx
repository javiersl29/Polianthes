"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Provider = {
  id: number;
  provider: "mercadopago" | "stripe";
  active: boolean;
  mp_access_token: string;
  mp_public_key: string;
  mp_webhook_secret: string;
  stripe_secret_key: string;
  stripe_publishable_key: string;
  stripe_webhook_secret: string;
  mode: "test" | "live";
  currency: string;
  installments_min: number;
  installments_max: number;
  notes: string | null;
};

type TestState = Record<"mercadopago" | "stripe", { loading: boolean; ok: boolean; message: string }>;

export default function AdminPaymentsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"mercadopago" | "stripe" | null>(null);
  const [tests, setTests] = useState<TestState>({
    mercadopago: { loading: false, ok: false, message: "" },
    stripe: { loading: false, ok: false, message: "" }
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/payments");
      const data = await r.json();
      setProviders(data.providers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const mp = providers.find((p) => p.provider === "mercadopago");
  const stripe = providers.find((p) => p.provider === "stripe");

  async function save(provider: "mercadopago" | "stripe", patch: Record<string, unknown>) {
    setSaving(provider);
    try {
      const r = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...patch })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Configuración de ${provider === "mercadopago" ? "MercadoPago" : "Stripe"} guardada`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  }

  async function test(provider: "mercadopago" | "stripe") {
    setTests({ ...tests, [provider]: { loading: true, ok: false, message: "Conectando…" } });
    try {
      const r = await fetch(`/api/admin/payments/test?provider=${provider}`);
      const data = await r.json();
      setTests({
        ...tests,
        [provider]: { loading: false, ok: !!data.ok, message: data.message ?? (data.ok ? "OK" : "Error") }
      });
      if (data.ok) toast.success(data.message);
      else toast.error(data.message ?? "Falló la prueba");
    } catch (e) {
      setTests({
        ...tests,
        [provider]: { loading: false, ok: false, message: e instanceof Error ? e.message : "Error" }
      });
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-mute">// Pagos</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Métodos de pago</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Configura tus cuentas de MercadoPago y Stripe. Una vez guardadas las credenciales y activado el
        proveedor, el checkout público ofrecerá pago con tarjetas y transferencias.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-ink-mute">Cargando…</p>
      ) : (
        <div className="mt-8 space-y-6">
          {/* MercadoPago */}
          {mp && (
            <PaymentCard
              title="MercadoPago"
              emoji="🟡"
              provider={mp}
              saving={saving === "mercadopago"}
              testState={tests.mercadopago}
              onSave={(patch) => save("mercadopago", patch)}
              onTest={() => test("mercadopago")}
              fields={[
                { key: "mp_access_token", label: "Access Token", placeholder: "APP_USR-… o TEST-…", type: "password" },
                { key: "mp_public_key", label: "Public Key", placeholder: "APP_USR-…", type: "text" },
                { key: "mp_webhook_secret", label: "Webhook Secret (opcional)", placeholder: "x-signature", type: "password" }
              ]}
              help="Encuentra tus credenciales en: MercadoPago → Tu aplicación → Credenciales. Usa TEST-* para modo pruebas."
            />
          )}

          {/* Stripe */}
          {stripe && (
            <PaymentCard
              title="Stripe"
              emoji="💳"
              provider={stripe}
              saving={saving === "stripe"}
              testState={tests.stripe}
              onSave={(patch) => save("stripe", patch)}
              onTest={() => test("stripe")}
              fields={[
                { key: "stripe_secret_key", label: "Secret Key", placeholder: "sk_test_… / sk_live_…", type: "password" },
                { key: "stripe_publishable_key", label: "Publishable Key", placeholder: "pk_test_… / pk_live_…", type: "text" },
                { key: "stripe_webhook_secret", label: "Webhook Secret", placeholder: "whsec_…", type: "password" }
              ]}
              help="Encuentra tus claves en: Stripe Dashboard → Developers → API keys. Activa 'test mode' con claves sk_test_*."
            />
          )}

          {/* URLs de webhook */}
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <h2 className="font-display italic text-2xl text-ink mb-3">URLs de webhook</h2>
            <p className="text-sm text-ink-mute mb-3">
              Configura estas URLs en el panel de cada proveedor para recibir confirmaciones de pago
              automáticas y actualizar el estado de los pedidos.
            </p>
            <div className="space-y-2">
              <WebhookUrl label="MercadoPago" url="/api/webhooks/mercadopago" />
              <WebhookUrl label="Stripe" url="/api/webhooks/stripe" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookUrl({ label, url }: { label: string; url: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const full = `${origin}${url}`;
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 liquid-glass rounded-lg">
      <span className="text-xs text-gold w-24 shrink-0">{label}</span>
      <code className="flex-1 text-xs text-ink/80 truncate">{full}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(full); toast.success("URL copiada"); }}
        className="rounded-full px-2 py-1 text-[11px] liquid-glass border border-line hover:border-gold/40 transition-colors"
      >
        Copiar
      </button>
    </div>
  );
}

function PaymentCard({
  title, emoji, provider, saving, testState, onSave, onTest, fields, help
}: {
  title: string;
  emoji: string;
  provider: Provider;
  saving: boolean;
  testState: { loading: boolean; ok: boolean; message: string };
  onSave: (patch: Record<string, unknown>) => void;
  onTest: () => void;
  fields: { key: string; label: string; placeholder: string; type: string }[];
  help: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(provider.active);
  const [mode, setMode] = useState<"test" | "live">(provider.mode);
  const [installmentsMin, setInstallmentsMin] = useState(provider.installments_min);
  const [installmentsMax, setInstallmentsMax] = useState(provider.installments_max);

  // Reset cuando cambia el provider
  useEffect(() => {
    setActive(provider.active);
    setMode(provider.mode);
    setInstallmentsMin(provider.installments_min);
    setInstallmentsMax(provider.installments_max);
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = ((provider as unknown) as Record<string, string>)[f.key] ?? "";
    setValues(v);
  }, [provider, fields]);

  function submit() {
    const patch: Record<string, unknown> = { active, mode, installments_min: installmentsMin, installments_max: installmentsMax };
    for (const f of fields) {
      const v = values[f.key] ?? "";
      // Si el valor trae "…", es la versión enmascarada que vino del server; no reenviar
      if (v.length > 0 && !v.includes("…") && !v.startsWith("••••")) {
        patch[f.key] = v;
      }
    }
    onSave(patch);
  }

  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display italic text-2xl text-ink flex items-center gap-2">
            <span>{emoji}</span> {title}
          </h2>
          <p className="text-xs text-ink-mute mt-1">{help}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${
          active ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                 : "border-white/10 bg-white/5 text-ink-mute"
        }`}>
          {active ? "Activo" : "Inactivo"} · {mode}
        </span>
      </div>

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-[11px] uppercase tracking-wider text-gold/80">{f.label}</label>
            <input
              type={f.type}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
            />
          </div>
        ))}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gold/80">Modo</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "test" | "live")}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
            >
              <option value="test">Test (sandbox)</option>
              <option value="live">Live (producción)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gold/80">Cuotas mín</label>
            <input
              type="number" min={1} max={36}
              value={installmentsMin}
              onChange={(e) => setInstallmentsMin(Number(e.target.value))}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gold/80">Cuotas máx</label>
            <input
              type="number" min={1} max={36}
              value={installmentsMax}
              onChange={(e) => setInstallmentsMax(Number(e.target.value))}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gold/80">Activo</label>
            <button
              onClick={() => setActive(!active)}
              className={`w-full mt-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                active ? "bg-emerald-400/10 border-emerald-300/30 text-emerald-300"
                       : "border-white/10 text-ink-mute hover:text-ink"
              }`}
            >
              {active ? "Sí" : "No"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={onTest}
          disabled={testState.loading}
          className="rounded-full liquid-glass border border-line px-4 py-2 text-sm hover:border-gold/40 disabled:opacity-50"
        >
          {testState.loading ? "Probando…" : "Probar conexión"}
        </button>
        {testState.message && (
          <span className={`text-xs ${testState.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {testState.ok ? "✓" : "✕"} {testState.message}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/cart";
import { toast } from "sonner";

type Zone = {
  id: number;
  name: string;
  postal_code_prefix: string;
  cost_cents: number;
  free_from_cents: number | null;
  estimated_days: string | null;
};

type Pickup = {
  id: number;
  name: string;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_schedule: string | null;
  phone: string | null;
  email: string | null;
};

type Provider = {
  provider: "mercadopago" | "stripe";
  mode: "test" | "live";
};

type DeliveryMode = "shipping" | "pickup";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();
  const [zones, setZones] = useState<Zone[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"mercadopago" | "stripe" | null>(null);

  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("shipping");
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);

  // Form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cp, setCp] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_cents: number } | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  useEffect(() => {
    Promise.all([
      fetch("/api/public/shipping-zones").then((r) => r.json()),
      fetch("/api/public/payment-providers").then((r) => r.json())
    ]).then(([z, p]) => {
      setZones(z.zones ?? []);
      setPickups(z.pickups ?? []);
      setProviders(p.providers ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Detectar zona por CP (sólo en modo shipping)
  const detectedZone = deliveryMode === "shipping"
    ? zones.find((z) => cp.startsWith(z.postal_code_prefix))
    : undefined;
  const selectedZoneId = deliveryMode === "pickup"
    ? selectedPickupId
    : detectedZone?.id;
  const shippingCents = deliveryMode === "pickup"
    ? 0
    : (detectedZone
        ? (detectedZone.free_from_cents && total.total_cents >= detectedZone.free_from_cents
          ? 0
          : detectedZone.cost_cents)
        : 0);
  const discountCents = appliedCoupon?.discount_cents ?? 0;
  const grandTotal = Math.max(0, total.total_cents - discountCents + shippingCents);

  const selectedPickup = pickups.find((p) => p.id === selectedPickupId);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponStatus("checking");
    try {
      const r = await fetch(`/api/public/coupon?code=${encodeURIComponent(couponCode)}&subtotal_cents=${total.total_cents}`);
      const data = await r.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.code, discount_cents: data.discount_cents });
        setCouponStatus("ok");
        toast.success(`Cupón aplicado: ${data.code}`);
      } else {
        setAppliedCoupon(null);
        setCouponStatus("error");
        toast.error(data.message ?? "Cupón inválido");
      }
    } catch {
      setCouponStatus("error");
    }
  }

  function validate(): string | null {
    if (items.length === 0) return "Tu carrito está vacío";
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) return "Email inválido";
    if (name.trim().length < 3) return "Nombre requerido";
    if (deliveryMode === "shipping") {
      if (!cp || cp.length < 4) return "Código postal inválido";
      if (!addressLine.trim()) return "Dirección requerida";
      if (!city.trim()) return "Ciudad requerida";
      if (!state.trim()) return "Estado requerido";
      if (!detectedZone) return `No hay zona de envío para el CP ${cp}. Revisa /admin/envio.`;
    } else {
      if (!selectedPickupId) return "Selecciona un sitio de entrega";
    }
    if (providers.length === 0) return "No hay métodos de pago activos. Configura uno en /admin/pagos.";
    return null;
  }

  async function submit(provider: "mercadopago" | "stripe") {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(provider);
    try {
      const r = await fetch(`/api/checkout/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ slug: i.slug, size_ml: i.size_ml, qty: i.qty })),
          customer: { email, name, phone: phone || undefined },
          shipping: {
            zone_id: selectedZoneId,
            kind: deliveryMode,
            address_line: addressLine,
            address_line2: addressLine2 || undefined,
            city, state, postal_code: cp
          },
          coupon_code: appliedCoupon?.code
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error al procesar el pago");

      clear();

      if (provider === "mercadopago" && data.init_point) {
        window.location.href = data.init_point;
      } else if (provider === "stripe" && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Respuesta inválida del proveedor");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <main className="pt-32 pb-20 px-4">
        <p className="text-center text-ink-mute">Cargando checkout…</p>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="font-display italic text-4xl text-ink">Carrito vacío</h1>
          <p className="mt-3 text-ink-mute">Añade fragancias antes de proceder al checkout.</p>
          <Link
            href="/#catalogo"
            className="inline-block mt-6 rounded-full bg-gold text-bg px-6 py-3 text-sm font-medium"
          >
            Ver catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-ink-mute">// Checkout</p>
        <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-1px]">Finalizar compra</h1>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {/* Cliente */}
            <section className="liquid-glass rounded-2xl p-5 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-4">1 · Datos del cliente</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre completo" value={name} onChange={setName} placeholder="María García" required />
                <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="maria@correo.com" required />
                <Input label="Teléfono (opcional)" value={phone} onChange={setPhone} placeholder="55 1234 5678" />
              </div>
            </section>

            {/* Modo de entrega */}
            <section className="liquid-glass rounded-2xl p-5 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-4">2 · Modo de entrega</h2>

              {/* Toggle shipping/pickup */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setDeliveryMode("shipping")}
                  className={`rounded-xl px-3 py-3 text-sm border transition-colors ${
                    deliveryMode === "shipping"
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line/40 text-ink/70 hover:text-ink"
                  }`}
                >
                  🚚 Enviar a domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode("pickup")}
                  disabled={pickups.length === 0}
                  className={`rounded-xl px-3 py-3 text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    deliveryMode === "pickup"
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line/40 text-ink/70 hover:text-ink"
                  }`}
                  title={pickups.length === 0 ? "No hay sitios configurados" : ""}
                >
                  🏬 Recoger en sitio {pickups.length === 0 && "(próximamente)"}
                </button>
              </div>

              {deliveryMode === "shipping" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Código postal"
                    value={cp}
                    onChange={(v) => { setCp(v); setAppliedCoupon(null); setCouponStatus("idle"); }}
                    placeholder="01000"
                    required
                  />
                  <div className="self-end">
                    {detectedZone ? (
                      <p className="text-xs text-emerald-300 mt-2">
                        ✓ Zona: <strong>{detectedZone.name}</strong>
                        {detectedZone.estimated_days && ` · ${detectedZone.estimated_days}`}
                        {shippingCents === 0 && <span className="ml-1 text-gold">(envío gratis)</span>}
                      </p>
                    ) : cp.length >= 4 ? (
                      <p className="text-xs text-rose-300 mt-2">No hay zona para este CP</p>
                    ) : null}
                  </div>
                  <Input label="Calle y número" value={addressLine} onChange={setAddressLine} placeholder="Av. Reforma 100" required className="sm:col-span-2" />
                  <Input label="Interior / Depto (opcional)" value={addressLine2} onChange={setAddressLine2} placeholder="Depto 304" />
                  <Input label="Ciudad" value={city} onChange={setCity} placeholder="CDMX" required />
                  <Input label="Estado" value={state} onChange={setState} placeholder="Ciudad de México" required />
                </div>
              ) : (
                <div>
                  {pickups.length === 0 ? (
                    <p className="text-sm text-ink-mute">No hay sitios de entrega configurados todavía.</p>
                  ) : (
                    <>
                      <p className="text-xs text-ink-mute mb-3">Elige dónde recoger tu pedido. El envío es gratuito.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pickups.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPickupId(p.id)}
                            className={`text-left rounded-xl px-4 py-3 text-sm border transition-colors ${
                              selectedPickupId === p.id
                                ? "border-gold bg-gold/10"
                                : "border-line/40 hover:border-gold/40"
                            }`}
                          >
                            <p className="font-medium text-ink">{p.name}</p>
                            <p className="text-[11px] text-ink-mute mt-0.5">{p.pickup_address}</p>
                            <p className="text-[11px] text-ink-mute">
                              {p.pickup_city}{p.pickup_city && p.pickup_state ? ", " : ""}{p.pickup_state}
                            </p>
                            {p.pickup_schedule && (
                              <p className="text-[10px] text-gold/70 mt-1">🕘 {p.pickup_schedule}</p>
                            )}
                          </button>
                        ))}
                      </div>
                      {selectedPickup && (
                        <div className="mt-3 p-3 rounded-lg liquid-glass text-xs text-ink-mute">
                          {selectedPickup.phone && <span className="mr-3">📞 {selectedPickup.phone}</span>}
                          {selectedPickup.email && <span>✉ {selectedPickup.email}</span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Cupón */}
            <section className="liquid-glass rounded-2xl p-5 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-3">3 · Cupón de descuento (opcional)</h2>
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus("idle"); }}
                  placeholder="Ej. VERANO10"
                  className="flex-1 bg-black/40 border border-line rounded-full px-4 py-2.5 text-sm text-white outline-none focus:border-gold font-mono"
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponStatus === "checking" || !couponCode.trim()}
                  className="rounded-full liquid-glass border border-line px-4 py-2.5 text-sm hover:border-gold/40 disabled:opacity-50"
                >
                  {couponStatus === "checking" ? "…" : "Aplicar"}
                </button>
              </div>
              {couponStatus === "ok" && appliedCoupon && (
                <p className="mt-2 text-xs text-emerald-300">
                  ✓ Cupón <strong>{appliedCoupon.code}</strong> aplicado: −{money(appliedCoupon.discount_cents)}
                </p>
              )}
              {couponStatus === "error" && (
                <p className="mt-2 text-xs text-rose-300">Cupón inválido o no aplica</p>
              )}
            </section>
          </div>

          {/* Resumen + pago */}
          <aside className="lg:col-span-2 space-y-4">
            <div className="liquid-glass rounded-2xl p-5 sticky top-24">
              <h2 className="font-display italic text-xl text-ink mb-3">Tu pedido</h2>
              <ul className="divide-y divide-line max-h-64 overflow-y-auto -mx-2 px-2">
                {items.map((it) => (
                  <li key={`${it.slug}-${it.size_ml}`} className="py-2 flex items-center gap-2 text-xs">
                    <span className="w-7 h-7 rounded bg-black/30 grid place-items-center shrink-0 text-[10px] text-gold/70">
                      {it.qty}×
                    </span>
                    <span className="flex-1 truncate text-ink">
                      {it.artistic_name ?? it.name} <span className="text-ink-mute">{it.size_ml}ml</span>
                    </span>
                    <span className="text-gold shrink-0">{money(it.unit_price_cents * it.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-3 border-t border-line space-y-1 text-sm">
                <Row label={`Subtotal (${total.units}u)`} value={money(total.total_cents)} />
                {discountCents > 0 && (
                  <Row label={`Descuento`} value={`−${money(discountCents)}`} accent="emerald" />
                )}
                <Row
                  label={deliveryMode === "pickup" ? "Recogida en sitio" : "Envío"}
                  value={deliveryMode === "pickup" ? "Gratis" : (shippingCents === 0 ? "Gratis" : money(shippingCents))}
                />
                <div className="pt-2 mt-2 border-t border-line flex justify-between font-medium">
                  <span className="text-ink">Total</span>
                  <span className="text-gold text-lg">{money(grandTotal)}</span>
                </div>
              </div>

              {/* Selección de pago */}
              <div className="mt-5 pt-4 border-t border-line">
                <p className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">Método de pago</p>
                {providers.length === 0 ? (
                  <p className="text-xs text-rose-300">
                    No hay proveedores activos. Configúralos en <Link href="/admin/pagos" className="underline">/admin/pagos</Link>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {providers.map((p) => (
                      <button
                        key={p.provider}
                        onClick={() => submit(p.provider)}
                        disabled={submitting !== null}
                        className="w-full rounded-xl bg-gold text-bg px-4 py-3 text-sm font-medium hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting === p.provider ? (
                          <span>Procesando…</span>
                        ) : (
                          <>
                            <span>{p.provider === "mercadopago" ? "🟡" : "💳"}</span>
                            Pagar con {p.provider === "mercadopago" ? "MercadoPago" : "Stripe"}
                            <span className="text-[10px] opacity-70">({p.mode})</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[10px] text-ink-mute text-center">
                  Serás redirigido al sitio seguro del proveedor para completar el pago.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder, required, className = ""
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] uppercase tracking-wider text-gold/80">{label}{required && " *"}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold"
      />
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "emerald" }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-mute">{label}</span>
      <span className={accent === "emerald" ? "text-emerald-300" : "text-ink"}>{value}</span>
    </div>
  );
}

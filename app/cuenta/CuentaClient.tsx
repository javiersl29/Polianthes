"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Customer = {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  phone: string | null;
  birth_date: string | null;
  affiliated: boolean;
  total_orders: number;
  total_spent_cents: number;
  default_address_line: string | null;
  default_address_line2: string | null;
  default_city: string | null;
  default_state: string | null;
  default_postal_code: string | null;
  default_country: string | null;
  created_at: string;
  last_login_at: string | null;
};

type Order = {
  id: number;
  public_id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  items_count: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-amber-300 border-amber-300/30 bg-amber-400/10" },
  approved: { label: "Aprobado", color: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10" },
  rejected: { label: "Rechazado", color: "text-rose-300 border-rose-300/30 bg-rose-400/10" },
  cancelled: { label: "Cancelado", color: "text-ink-mute border-white/10 bg-white/5" },
  refunded: { label: "Reembolsado", color: "text-violet-300 border-violet-300/30 bg-violet-400/10" },
  in_transit: { label: "En tránsito", color: "text-sky-300 border-sky-300/30 bg-sky-400/10" },
  delivered: { label: "Entregado", color: "text-gold border-gold/30 bg-gold/10" }
};

function money(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export default function CuentaClient({
  initialCustomer,
  initialOrders
}: {
  initialCustomer: Customer;
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initialCustomer);
  const [orders] = useState(initialOrders);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form state
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [birthDate, setBirthDate] = useState(customer.birth_date ?? "");
  const [addressLine, setAddressLine] = useState(customer.default_address_line ?? "");
  const [addressLine2, setAddressLine2] = useState(customer.default_address_line2 ?? "");
  const [city, setCity] = useState(customer.default_city ?? "");
  const [stateField, setStateField] = useState(customer.default_state ?? "");
  const [cp, setCp] = useState(customer.default_postal_code ?? "");
  const [country, setCountry] = useState(customer.default_country ?? "MX");

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const r = await fetch("/api/customer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          birth_date: birthDate || null,
          default_address_line: addressLine || null,
          default_address_line2: addressLine2 || null,
          default_city: city || null,
          default_state: stateField || null,
          default_postal_code: cp || null,
          default_country: country || "MX"
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setCustomer((c) => ({ ...c, ...data.customer }));
      toast.success("Perfil actualizado");
      setEditingProfile(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAffiliate() {
    try {
      const r = await fetch("/api/customer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliate: true })
      });
      if (!r.ok) throw new Error();
      setCustomer((c) => ({ ...c, affiliated: true }));
      toast.success("¡Cuenta afiliada!");
    } catch {
      toast.error("Error al afiliar");
    }
  }

  async function handleLogout() {
    await fetch("/api/customer/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    });
    router.push("/");
  }

  return (
    <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-ink-mute">// Mi cuenta</p>
        <h1 className="mt-2 font-display italic text-4xl sm:text-5xl text-ink tracking-[-2px]">
          Hola, {customer.name.split(" ")[0]}
        </h1>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Perfil + stats */}
          <div className="lg:col-span-1 space-y-4">
            <div className="liquid-glass rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-3">
                {customer.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customer.picture_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 grid place-items-center text-gold text-lg font-semibold">
                    {customer.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{customer.name}</p>
                  <p className="text-xs text-ink-mute truncate">{customer.email}</p>
                </div>
              </div>
              {customer.affiliated ? (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-gold border border-gold/30 bg-gold/10 rounded-lg px-2.5 py-1.5 w-fit">
                  <span>★</span> Cuenta afiliada
                </div>
              ) : (
                <button
                  onClick={handleAffiliate}
                  className="mt-3 w-full rounded-full liquid-glass border border-gold/30 px-3 py-2 text-xs text-gold hover:bg-gold/10 transition-colors"
                >
                  ★ Afiliarme
                </button>
              )}
              <div className="mt-4 pt-4 border-t border-line/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-ink-mute">
                  <span>Pedidos</span>
                  <span className="text-ink">{customer.total_orders}</span>
                </div>
                <div className="flex justify-between text-ink-mute">
                  <span>Total gastado</span>
                  <span className="text-ink">{money(customer.total_spent_cents)}</span>
                </div>
                <div className="flex justify-between text-ink-mute">
                  <span>Miembro desde</span>
                  <span className="text-ink">
                    {new Date(customer.created_at).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-4 w-full rounded-full liquid-glass border border-line px-3 py-2 text-xs text-ink-mute hover:text-rose-300 hover:border-rose-300/30 transition-colors"
              >
                ↪ Cerrar sesión
              </button>
            </div>
          </div>

          {/* Form de perfil + pedidos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Perfil */}
            <div className="liquid-glass rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display italic text-xl text-ink">Datos personales</h2>
                {!editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="rounded-full liquid-glass border border-line px-3 py-1.5 text-xs hover:border-gold/40"
                  >
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingProfile(false)}
                      disabled={savingProfile}
                      className="rounded-full liquid-glass border border-line px-3 py-1.5 text-xs hover:border-gold/40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="rounded-full bg-gold text-bg px-3 py-1.5 text-xs font-medium hover:bg-gold/90 disabled:opacity-50"
                    >
                      {savingProfile ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre" value={name} onChange={setName} disabled={!editingProfile} />
                <Field label="Email" value={customer.email} disabled />
                <Field label="Teléfono" value={phone} onChange={setPhone} disabled={!editingProfile} placeholder="55 1234 5678" />
                <Field label="Fecha de nacimiento" type="date" value={birthDate} onChange={setBirthDate} disabled={!editingProfile} />
              </div>

              <h3 className="mt-5 mb-3 text-[11px] uppercase tracking-wider text-gold/80">Dirección predeterminada</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Calle y número" value={addressLine} onChange={setAddressLine} disabled={!editingProfile} />
                <Field label="Depto / Interior" value={addressLine2} onChange={setAddressLine2} disabled={!editingProfile} />
                <Field label="Ciudad" value={city} onChange={setCity} disabled={!editingProfile} />
                <Field label="Estado" value={stateField} onChange={setStateField} disabled={!editingProfile} />
                <Field label="Código postal" value={cp} onChange={setCp} disabled={!editingProfile} />
                <Field label="País" value={country} onChange={setCountry} disabled={!editingProfile} />
              </div>
            </div>

            {/* Pedidos */}
            <div id="pedidos" className="liquid-glass rounded-2xl p-5 sm:p-6">
              <h2 className="font-display italic text-xl text-ink mb-3">Mis pedidos</h2>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-ink-mute">Aún no tienes pedidos.</p>
                  <Link href="/#catalogo" className="mt-3 inline-block rounded-full bg-gold text-bg px-4 py-2 text-xs font-medium hover:bg-gold/90 transition-colors">
                    Explorar catálogo
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {orders.map((o) => {
                    const meta = STATUS_LABELS[o.status] ?? STATUS_LABELS.pending;
                    return (
                      <li key={o.id} className="py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0">
                          <Link href={`/cuenta/pedido/${o.id}`} className="text-sm text-gold hover:underline font-mono">
                            {o.public_id}
                          </Link>
                          <p className="text-[11px] text-ink-mute">
                            {o.items_count} {o.items_count === 1 ? "item" : "items"} ·{" "}
                            {new Date(o.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${meta.color}`}>
                          {meta.label}
                        </span>
                        <p className="text-sm text-ink shrink-0 w-24 text-right">{money(o.total_cents, o.currency)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gold/80">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
      />
    </label>
  );
}

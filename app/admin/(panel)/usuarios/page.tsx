"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AdminUser = {
  id: number;
  username: string;
  created_at: string;
};

type Customer = {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  phone: string | null;
  email_verified: boolean;
  affiliated: boolean;
  total_orders: number;
  total_spent_cents: number;
  last_login_at: string | null;
  created_at: string;
};

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<"admins" | "customers">("admins");

  return (
    <div>
      <p className="text-sm text-ink-mute">// Usuarios</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Gestión de usuarios</h1>
      <p className="mt-3 text-ink-mute max-w-2xl">
        Administra los usuarios con acceso al panel y gestiona los clientes registrados en la tienda.
      </p>

      {/* Tabs */}
      <div className="liquid-glass rounded-full p-1 flex mt-6 w-fit">
        <button
          onClick={() => setTab("admins")}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === "admins" ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
          }`}
        >
          🔐 Administradores
        </button>
        <button
          onClick={() => setTab("customers")}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === "customers" ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
          }`}
        >
          👥 Clientes
        </button>
      </div>

      <div className="mt-6">
        {tab === "admins" ? <AdminsTab /> : <CustomersTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Administradores (acceso al panel)
// ─────────────────────────────────────────────
function AdminsTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users");
      const data = await r.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (newUsername.trim().length < 3 || newPassword.length < 6) {
      toast.error("Usuario mínimo 3 caracteres, contraseña mínimo 6");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Usuario '${data.user.username}' creado`);
      setNewUsername("");
      setNewPassword("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteUser(id: number, username: string) {
    if (!confirm(`¿Eliminar el usuario '${username}'? Esta acción no se puede deshacer.`)) return;
    try {
      const r = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Usuario '${username}' eliminado`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function resetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetTarget.id, action: "reset_password", password: resetPassword })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Contraseña de '${resetTarget.username}' actualizada`);
      setResetTarget(null);
      setResetPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="liquid-glass rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display italic text-2xl text-ink">Listado de administradores</h2>
            <span className="text-xs text-ink-mute">{users.length} usuarios</span>
          </div>
          {loading ? (
            <p className="text-sm text-ink-mute">Cargando…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-ink-mute">Sin usuarios. Crea el primero →</p>
          ) : (
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{u.username}</p>
                    <p className="text-[11px] text-ink-mute">
                      Creado {new Date(u.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setResetTarget(u); setResetPassword(""); }}
                      className="liquid-glass rounded-full px-3 py-1.5 text-xs text-ink hover:text-gold transition-colors"
                    >
                      Cambiar contraseña
                    </button>
                    <button
                      onClick={() => deleteUser(u.id, u.username)}
                      className="rounded-full px-3 py-1.5 text-xs text-rose-300 border border-rose-300/30 hover:bg-rose-400/10 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="liquid-glass rounded-2xl p-4 sm:p-6">
          <h2 className="font-display italic text-xl text-ink mb-3">Nuevo administrador</h2>
          <form onSubmit={createUser} className="space-y-3">
            <div>
              <label className="field-label text-[11px] uppercase tracking-wider text-gold/80">Nombre de usuario</label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="field-input w-full rounded-xl bg-black/40 border border-line px-3 py-2 text-sm text-white outline-none focus:border-gold mt-1"
                placeholder="ej. editor.maria"
                minLength={3}
                required
              />
            </div>
            <div>
              <label className="field-label text-[11px] uppercase tracking-wider text-gold/80">Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field-input w-full rounded-xl bg-black/40 border border-line px-3 py-2 text-sm text-white outline-none focus:border-gold mt-1"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creando…" : "Crear administrador"}
            </button>
          </form>
        </div>
      </div>

      {resetTarget && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setResetTarget(null)}
        >
          <form
            onSubmit={resetPasswordSubmit}
            className="liquid-glass rounded-3xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display italic text-2xl text-ink">
              Cambiar contraseña de {resetTarget.username}
            </h3>
            <p className="mt-1 text-xs text-ink-mute">
              La nueva contraseña se aplicará inmediatamente.
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="field-input w-full rounded-xl bg-black/40 border border-line px-3 py-2 text-sm text-white outline-none focus:border-gold mt-4"
              placeholder="Nueva contraseña"
              minLength={6}
              required
            />
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-full px-4 py-2 text-sm text-ink-mute hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Clientes (compradores registrados)
// ─────────────────────────────────────────────
function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load(q: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await r.json();
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  async function deleteCustomer(c: Customer) {
    if (!confirm(`¿Eliminar al cliente "${c.email}"?\n\nSe eliminarán sus datos personales, dirección guardada y preferencias.\nSus pedidos anteriores se conservarán de forma anónima.`)) return;
    setDeletingId(c.id);
    try {
      const r = await fetch(`/api/admin/customers?id=${c.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Cliente ${data.deleted_email} eliminado`);
      load(search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setDeletingId(null);
    }
  }

  const totalRevenue = customers.reduce((s, c) => s + c.total_spent_cents, 0);
  const totalOrders = customers.reduce((s, c) => s + c.total_orders, 0);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-mute">Clientes registrados</p>
          <p className="mt-1 text-2xl font-display italic text-ink">{customers.length}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-mute">Pedidos totales</p>
          <p className="mt-1 text-2xl font-display italic text-ink">{totalOrders}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-mute">Ingresos generados</p>
          <p className="mt-1 text-2xl font-display italic text-gold">{money(totalRevenue)}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="liquid-glass rounded-full px-4 py-2.5 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-mute shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por email o nombre"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
        />
      </div>

      {/* Lista */}
      <div className="liquid-glass rounded-2xl p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-ink-mute">Cargando clientes…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-ink-mute text-center py-8">
            {search ? "Sin resultados para esa búsqueda." : "Aún no hay clientes registrados."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {c.picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.picture_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0 bg-black/30"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 grid place-items-center text-gold text-xs font-semibold shrink-0">
                      {c.name?.[0]?.toUpperCase() ?? c.email[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-ink truncate font-medium">{c.name}</p>
                      {c.email_verified ? (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
                          Verificado
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-300/30 bg-amber-400/10 text-amber-300">
                          Sin verificar
                        </span>
                      )}
                      {c.affiliated && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10 text-gold">
                          ★ Afiliado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-mute truncate">{c.email}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-ink-mute">
                      <span>{c.total_orders} pedido{c.total_orders === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{money(c.total_spent_cents)} gastados</span>
                      <span>·</span>
                      <span>Registro: {new Date(c.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      {c.last_login_at && (
                        <>
                          <span>·</span>
                          <span>Último login: {new Date(c.last_login_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteCustomer(c)}
                  disabled={deletingId === c.id}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs text-rose-300 border border-rose-300/30 hover:bg-rose-400/10 transition-colors disabled:opacity-50"
                  title="Eliminar cliente (los pedidos se conservan anónimos)"
                >
                  {deletingId === c.id ? "…" : "Eliminar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-ink-mute/60 text-center">
        💡 Por privacidad, no se muestran contraseñas ni tokens. Los pedidos de clientes eliminados
        se conservan de forma anónima (customer_id = NULL) para efectos contables y de garantía.
      </p>
    </div>
  );
}
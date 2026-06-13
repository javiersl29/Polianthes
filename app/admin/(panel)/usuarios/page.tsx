"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type User = {
  id: number;
  username: string;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
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
    <div>
      <p className="text-sm text-ink-mute">// Usuarios</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Administradores</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Gestiona los usuarios con acceso al panel. Todos los administradores tienen acceso completo.
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="liquid-glass rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-display italic text-2xl text-ink">Listado</h2>
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
            <h2 className="font-display italic text-xl text-ink mb-3">Nuevo usuario</h2>
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
                {creating ? "Creando…" : "Crear usuario"}
              </button>
            </form>
          </div>
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

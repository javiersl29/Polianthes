"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type NavLink = {
  id: number;
  location: "navbar" | "footer" | "mobile";
  label: string;
  href: string;
  sort_order: number;
  icon: string | null;
  new_tab: boolean;
  admin_only: boolean;
  active: boolean;
};

type EditingState = Partial<NavLink> & { id?: number };

const EMPTY: EditingState = {
  location: "navbar",
  label: "",
  href: "",
  sort_order: 0,
  icon: "",
  new_tab: false,
  admin_only: false,
  active: true
};

export default function AdminMenuPage() {
  const [links, setLinks] = useState<NavLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterLoc, setFilterLoc] = useState<"navbar" | "footer" | "mobile">("navbar");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/nav");
      const data = await r.json();
      setLinks(data.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.label || !editing.href) {
      toast.error("Etiqueta y URL son obligatorias");
      return;
    }
    setSaving(true);
    try {
      const method = editing.id ? "PATCH" : "POST";
      const r = await fetch("/api/admin/nav", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(editing.id ? "Enlace actualizado" : "Enlace creado");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, label: string) {
    if (!confirm(`¿Eliminar "${label}"?`)) return;
    try {
      const r = await fetch(`/api/admin/nav?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error");
      toast.success("Enlace eliminado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleActive(l: NavLink) {
    try {
      const r = await fetch("/api/admin/nav", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...l, active: !l.active })
      });
      if (!r.ok) throw new Error("Error");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  const grouped = {
    navbar: links.filter((l) => l.location === "navbar"),
    footer: links.filter((l) => l.location === "footer"),
    mobile: links.filter((l) => l.location === "mobile")
  };
  const visible = grouped[filterLoc];

  return (
    <div>
      <p className="text-sm text-ink-mute">// Menús</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Enlaces del sitio</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Edita los enlaces del navbar (barra superior), el footer y el menú móvil.
        Arrastra con el número de orden para reorganizar.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          {(["navbar", "footer", "mobile"] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => setFilterLoc(loc)}
              className={`rounded-full px-3 py-2 text-xs transition-colors ${
                filterLoc === loc ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
              }`}
            >
              {loc === "navbar" ? "Navbar" : loc === "footer" ? "Footer" : "Móvil"}
              <span className="ml-1.5 opacity-60">({grouped[loc].length})</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY, location: filterLoc })}
          className="rounded-full bg-gold text-bg px-4 py-2 text-xs font-medium hover:bg-gold/90"
        >
          + Nuevo enlace
        </button>
      </div>

      <div className="mt-6 liquid-glass rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-ink-mute">Cargando…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-mute">No hay enlaces en {filterLoc}. Crea el primero.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-line">
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Orden</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Etiqueta</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">URL</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium">Opciones</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-mute font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((l) => (
                <tr key={l.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-ink-mute font-mono">{l.sort_order}</td>
                  <td className="px-4 py-3 text-ink">
                    {l.icon && <span className="mr-1">{l.icon}</span>}
                    {l.label}
                  </td>
                  <td className="px-4 py-3 text-ink/80 font-mono text-xs truncate max-w-[200px]">{l.href}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {l.new_tab && <span className="px-1.5 py-0.5 text-[9px] rounded border border-sky-300/30 bg-sky-400/10 text-sky-300">Nueva pestaña</span>}
                      {l.admin_only && <span className="px-1.5 py-0.5 text-[9px] rounded border border-violet-300/30 bg-violet-400/10 text-violet-300">Admin</span>}
                      <button
                        onClick={() => toggleActive(l)}
                        className={`px-1.5 py-0.5 text-[9px] rounded border ${
                          l.active ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                                   : "border-white/10 bg-white/5 text-ink-mute"
                        }`}
                      >
                        {l.active ? "Activo" : "Inactivo"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(l)}
                      className="text-xs text-ink hover:text-gold mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(l.id, l.label)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="liquid-glass rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display italic text-2xl text-ink mb-4">
              {editing.id ? "Editar enlace" : "Nuevo enlace"}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Etiqueta *</span>
                <input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="Catálogo"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">URL *</span>
                <input
                  value={editing.href ?? ""}
                  onChange={(e) => setEditing({ ...editing, href: e.target.value })}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold font-mono"
                  placeholder="/#catalogo o https://…"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-gold/80">Ubicación</span>
                  <select
                    value={editing.location ?? "navbar"}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value as EditingState["location"] })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  >
                    <option value="navbar">Navbar</option>
                    <option value="footer">Footer</option>
                    <option value="mobile">Móvil</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-gold/80">Orden</span>
                  <input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                    className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Icono (emoji o texto)</span>
                <input
                  value={editing.icon ?? ""}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value || null })}
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  placeholder="🌸 (opcional)"
                />
              </label>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!!editing.new_tab}
                    onChange={(e) => setEditing({ ...editing, new_tab: e.target.checked })}
                    className="accent-[color:var(--color-gold)]"
                  />
                  Abrir en nueva pestaña
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!!editing.admin_only}
                    onChange={(e) => setEditing({ ...editing, admin_only: e.target.checked })}
                    className="accent-[color:var(--color-gold)]"
                  />
                  Sólo admins
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!!editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="accent-[color:var(--color-gold)]"
                  />
                  Activo
                </label>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-full px-4 py-2 text-sm text-ink-mute hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

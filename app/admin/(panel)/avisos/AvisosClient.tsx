"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type Announcement = {
  id: number;
  text: string;
  link_url: string | null;
  link_label: string;
  icon: string;
  bg_color: string;
  sort_order: number;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
};

const COLORS = [
  { v: "gold", l: "Dorado", cls: "bg-gold text-bg" },
  { v: "emerald", l: "Esmeralda", cls: "bg-emerald-500 text-white" },
  { v: "rose", l: "Rosa", cls: "bg-rose-500 text-white" },
  { v: "sky", l: "Cielo", cls: "bg-sky-500 text-white" },
  { v: "violet", l: "Violeta", cls: "bg-violet-500 text-white" },
  { v: "dark", l: "Oscuro", cls: "bg-bg-elev text-gold border border-gold/30" },
];

const ICONS = ["🎁", "🚚", "💰", "✨", "🔥", "⭐", "💡", "🎯", "💜", "🏷️"];

export default function AnnouncementsClient() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const r = await fetch("/api/admin/announcements");
    const data = await r.json();
    setItems(data.announcements ?? []);
    setLoading(false);
  }

  function startNew() {
    setEditing({ text: "", link_url: "", link_label: "Ver más", icon: "🎁", bg_color: "gold", sort_order: 0, active: true });
    setIsNew(true);
  }

  function startEdit(a: Announcement) {
    setEditing({ ...a });
    setIsNew(false);
  }

  async function save() {
    if (!editing?.text?.trim()) { toast.error("El texto es obligatorio"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const r = await fetch("/api/admin/announcements", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing)
        });
        if (!r.ok) throw new Error();
        toast.success("Aviso creado");
      } else {
        const r = await fetch(`/api/admin/announcements/${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing)
        });
        if (!r.ok) throw new Error();
        toast.success("Aviso actualizado");
      }
      setEditing(null);
      await reload();
      // Revalidate homepage
      fetch("/api/revalidate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/" })
      }).catch(() => {});
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function del(a: Announcement) {
    if (!confirm(`¿Eliminar "${a.text}"?`)) return;
    await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    toast.success("Eliminado");
    await reload();
  }

  async function toggleActive(a: Announcement) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active })
    });
    await reload();
  }

  const colorCls = (c: string) => COLORS.find(x => x.v === c)?.cls ?? COLORS[0].cls;

  if (loading) return <p className="text-ink-mute text-sm">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-ink-mute">// Marketing</p>
          <h1 className="mt-1 font-display italic text-4xl sm:text-5xl text-ink tracking-[-2px]">Avisos del cintillo</h1>
          <p className="mt-2 text-sm text-ink-mute max-w-xl">
            Configura los mensajes que aparecen en el cintillo flotante superior de todas las páginas.
            Rotan automáticamente cada 5 segundos.
          </p>
        </div>
        <button onClick={startNew} className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90">
          + Nuevo aviso
        </button>
      </div>

      {/* Preview */}
      <div className="liquid-glass rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-2">Vista previa del cintillo</p>
        <div className="space-y-1">
          {items.filter(a => a.active).map(a => (
            <div key={a.id} className={`flex items-center gap-2 py-1.5 px-3 rounded-lg ${colorCls(a.bg_color)}`}>
              <span className="text-sm">{a.icon}</span>
              <span className="text-xs font-medium flex-1 truncate">{a.text}</span>
              <span className="text-[10px] font-bold underline opacity-80">{a.link_label} →</span>
            </div>
          ))}
          {items.filter(a => a.active).length === 0 && (
            <p className="text-xs text-ink-mute text-center py-2">No hay avisos activos</p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(a => (
          <div key={a.id} className={`liquid-glass rounded-xl p-3 flex items-center gap-3 ${!a.active ? "opacity-50" : ""}`}>
            <span className="text-xl shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{a.text}</p>
              <p className="text-[10px] text-ink-mute truncate">
                {a.link_url ?? "Sin enlace"} · {a.link_label} · orden {a.sort_order}
              </p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${colorCls(a.bg_color)}`}>
              {a.bg_color}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(a)} className="rounded-full liquid-glass border border-line/40 px-2 py-1 text-[10px] hover:border-gold/40">Editar</button>
              <button onClick={() => toggleActive(a)} className="rounded-full liquid-glass border border-line/40 px-2 py-1 text-[10px] hover:border-gold/40">{a.active ? "Pausar" : "Activar"}</button>
              <button onClick={() => del(a)} className="rounded-full px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-400/10">✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !saving && setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="liquid-glass-strong rounded-2xl max-w-lg w-full p-5 space-y-3">
            <h2 className="font-display italic text-2xl text-ink">{isNew ? "Nuevo aviso" : "Editar aviso"}</h2>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Texto del aviso</span>
              <input type="text" value={editing.text ?? ""} onChange={e => setEditing({ ...editing, text: e.target.value })}
                placeholder="Ej: Envío gratis en compras +$500"
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">URL del enlace</span>
                <input type="text" value={editing.link_url ?? ""} onChange={e => setEditing({ ...editing, link_url: e.target.value })}
                  placeholder="/#ofertas"
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-gold/80">Texto del botón</span>
                <input type="text" value={editing.link_label ?? ""} onChange={e => setEditing({ ...editing, link_label: e.target.value })}
                  placeholder="Ver ofertas"
                  className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
              </label>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Icono</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setEditing({ ...editing, icon: ic })}
                    className={`w-9 h-9 rounded-lg text-lg grid place-items-center transition-all ${editing.icon === ic ? "bg-gold text-bg ring-2 ring-gold" : "bg-black/30 hover:bg-black/50"}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Color de fondo</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COLORS.map(c => (
                  <button key={c.v} type="button" onClick={() => setEditing({ ...editing, bg_color: c.v })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${c.cls} ${editing.bg_color === c.v ? "ring-2 ring-gold" : "opacity-60 hover:opacity-100"}`}>
                    {c.l}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Orden</span>
              <input type="number" value={String(editing.sort_order ?? 0)} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold" />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={editing.active ?? false} onChange={e => setEditing({ ...editing, active: e.target.checked })}
                className="h-4 w-4 accent-gold" />
              Activo (visible en el cintillo)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="rounded-full liquid-glass border border-line px-4 py-2 text-sm hover:border-gold/40 disabled:opacity-50">Cancelar</button>
              <button onClick={save} disabled={saving || !editing.text?.trim()}
                className="rounded-full bg-gold text-bg px-5 py-2 text-sm font-medium hover:bg-gold/90 disabled:opacity-50">
                {saving ? "Guardando…" : isNew ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

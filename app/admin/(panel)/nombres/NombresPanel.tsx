"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Status = {
  total: number;
  with_name: number;
  running: boolean;
};

export default function NombresPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/admin/fragrances/regenerate-artistic-names", { cache: "no-store" });
      const j = (await r.json()) as Status;
      setStatus(j);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 5000);
    return () => clearInterval(t);
  }, []);

  const regenerate = async (onlyMissing: boolean) => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/fragrances/regenerate-artistic-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ only_missing: onlyMissing })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      toast.success("Generación iniciada. Esta página se actualiza sola cada 5s.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const missing = status ? status.total - status.with_name : 0;
  const pct = status && status.total > 0 ? Math.round((status.with_name / status.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display italic text-2xl sm:text-3xl text-ink">Nombres artísticos</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Genera con IA un nombre poético en español para cada fragancia Polianthes (estilo Étoile, Velours, Brume…).
        </p>
      </div>

      {status ? (
        <div className="liquid-glass rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-mute">Progreso</span>
            <span className="text-ink font-medium">{status.with_name} / {status.total}</span>
          </div>
          <div className="h-2 bg-bg-elev rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-ink-mute">
            <span>· {status.with_name} con nombre artístico</span>
            <span>· {missing} pendientes</span>
            {status.running && <span className="text-gold">· generando…</span>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-mute">Cargando…</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => regenerate(true)}
          disabled={loading || (status?.running ?? false)}
          className="liquid-glass-strong rounded-full px-5 py-3 text-sm hover:text-gold transition-colors disabled:opacity-50"
        >
          {missing > 0 ? `Generar ${missing} nombres pendientes` : "Generar pendientes"}
        </button>
        <button
          onClick={() => {
            if (confirm("¿Regenerar TODOS los nombres (sobrescribe los existentes)?")) regenerate(false);
          }}
          disabled={loading || (status?.running ?? false)}
          className="liquid-glass rounded-full px-5 py-3 text-sm hover:text-gold transition-colors disabled:opacity-50"
        >
          Regenerar todos (sobrescribe)
        </button>
      </div>

      <div className="liquid-glass rounded-2xl p-4 text-xs text-ink-mute space-y-1">
        <p>· Tarda ~30-60 segundos para 146 fragancias (200ms entre llamadas).</p>
        <p>· Si una fragancia no recibe nombre válido, queda pendiente y puedes reintentar.</p>
        <p>· El modelo de IA se configura en <a href="/admin/ai" className="text-gold hover:underline">Configuración IA</a>.</p>
      </div>
    </div>
  );
}

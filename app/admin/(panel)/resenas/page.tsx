"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Review = {
  id: number;
  fragrance_id: number;
  fragrance_slug: string;
  brand: string;
  name: string;
  full_name: string;
  artistic_name: string | null;
  image_url: string | null;
  author_name: string;
  author_email: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: "pending" | "approved" | "rejected";
  verified_purchase: boolean;
  admin_response: string | null;
  rejected_reason: string | null;
  created_at: string;
};

type Filter = "pending" | "approved" | "rejected" | "all";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [respondingTo, setRespondingTo] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/reviews?status=${filter}`);
      const data = await r.json();
      setReviews(data.reviews ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function action(id: number, action: "approve" | "reject" | "delete", extra?: Record<string, unknown>) {
    try {
      const r = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(
        action === "approve" ? "Reseña aprobada" :
        action === "reject" ? "Reseña rechazada" :
        "Reseña eliminada"
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function submitResponse() {
    if (!respondingTo) return;
    try {
      const r = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: respondingTo.id, action: "respond", response: responseText })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Respuesta publicada");
      setRespondingTo(null);
      setResponseText("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-mute">// Reseñas</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Moderación de reseñas</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Aprueba o rechaza las reseñas que envían los clientes desde la ficha de cada fragancia.
        Las aprobadas se publican automáticamente; las rechazadas quedan ocultas.
      </p>

      <div className="mt-6 flex items-center gap-1 overflow-x-auto">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs transition-colors ${
              filter === f ? "bg-ink text-bg" : "liquid-glass text-ink/80 hover:text-gold"
            }`}
          >
            {f === "pending" ? "Pendientes" : f === "approved" ? "Aprobadas" : f === "rejected" ? "Rechazadas" : "Todas"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-mute">Cargando…</p>
      ) : reviews.length === 0 ? (
        <div className="mt-6 liquid-glass rounded-2xl p-6 text-center">
          <p className="font-display italic text-xl text-ink">No hay reseñas en este estado</p>
          <p className="mt-2 text-sm text-ink-mute">
            Cuando los clientes envíen reseñas desde la ficha de producto, aparecerán aquí para moderación.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="liquid-glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Link
                  href={`/fragancias/${r.fragrance_slug}`}
                  className="w-12 h-14 rounded-lg bg-black/30 overflow-hidden shrink-0 grid place-items-center"
                >
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gold/40 text-xs">{r.brand[0]}</span>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-ink font-medium">
                        {r.author_name}
                        {r.verified_purchase && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
                            ✓ Verificada
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-mute">
                        {r.author_email ?? "—"} · {new Date(r.created_at).toLocaleString("es-MX")}
                      </p>
                      <p className="text-[11px] text-gold/70 mt-0.5">
                        {r.artistic_name ?? r.name} · {r.brand}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-gold">{"★".repeat(r.rating)}<span className="text-ink-mute/30">{"★".repeat(5 - r.rating)}</span></span>
                      <p className="mt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                          r.status === "approved" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                          : r.status === "rejected" ? "border-rose-300/30 bg-rose-400/10 text-rose-300"
                          : "border-amber-300/30 bg-amber-400/10 text-amber-300"
                        }`}>
                          {r.status === "approved" ? "Aprobada" : r.status === "rejected" ? "Rechazada" : "Pendiente"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {r.title && <p className="mt-2 text-sm font-medium text-ink">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm text-ink/90 whitespace-pre-line">{r.body}</p>}

                  {r.admin_response && (
                    <div className="mt-3 ml-3 pl-3 border-l-2 border-gold/40">
                      <p className="text-[10px] uppercase tracking-wider text-gold/80">Tu respuesta</p>
                      <p className="text-sm text-ink/90">{r.admin_response}</p>
                    </div>
                  )}
                  {r.rejected_reason && (
                    <p className="mt-2 text-[11px] text-rose-300/80">Motivo: {r.rejected_reason}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "approved" && (
                      <button
                        onClick={() => action(r.id, "approve")}
                        className="rounded-full px-3 py-1.5 text-xs border border-emerald-300/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                      >
                        ✓ Aprobar
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        onClick={() => action(r.id, "reject")}
                        className="rounded-full px-3 py-1.5 text-xs border border-rose-300/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
                      >
                        ✕ Rechazar
                      </button>
                    )}
                    <button
                      onClick={() => { setRespondingTo(r); setResponseText(r.admin_response ?? ""); }}
                      className="rounded-full liquid-glass border border-line px-3 py-1.5 text-xs hover:border-gold/40"
                    >
                      💬 Responder
                    </button>
                    <button
                      onClick={() => { if (confirm("¿Eliminar esta reseña permanentemente?")) action(r.id, "delete"); }}
                      className="rounded-full px-3 py-1.5 text-xs text-ink-mute hover:text-rose-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {respondingTo && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
          onClick={() => setRespondingTo(null)}
        >
          <div
            className="liquid-glass rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display italic text-2xl text-ink">Responder a {respondingTo.author_name}</h3>
            <p className="mt-1 text-xs text-ink-mute">
              Tu respuesta será visible públicamente bajo la reseña.
            </p>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
              className="mt-4 w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold resize-y"
              placeholder="Gracias por compartir tu experiencia…"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={submitResponse}
                className="flex-1 rounded-full bg-gold text-bg px-4 py-2 text-sm font-medium hover:bg-gold/90"
              >
                Publicar respuesta
              </button>
              <button
                onClick={() => setRespondingTo(null)}
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

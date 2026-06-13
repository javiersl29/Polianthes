"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type Review = {
  id: number;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  admin_response: string | null;
  created_at: string;
};

export default function FragranceReviews({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  // Form state
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/public/reviews?slug=${encodeURIComponent(slug)}`);
      const data = await r.json();
      setReviews(data.reviews ?? []);
      setAvg(data.average_rating ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (authorName.trim().length < 2) {
      toast.error("Tu nombre es muy corto");
      return;
    }
    if (body.trim().length < 10) {
      toast.error("El comentario debe tener al menos 10 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          author_name: authorName,
          author_email: authorEmail || undefined,
          rating,
          title: title || undefined,
          body
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(data.message ?? "Reseña enviada");
      setShowForm(false);
      setAuthorName(""); setAuthorEmail(""); setTitle(""); setBody(""); setRating(5);
      startTransition(() => { load(); });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-12 sm:mt-16" aria-labelledby="reviews-section">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-gold/80 uppercase tracking-[0.2em]">// Comunidad</p>
          <h2 id="reviews-section" className="mt-1 font-display italic text-3xl sm:text-4xl text-ink leading-tight">
            Reseñas
          </h2>
          {avg !== null && reviews.length > 0 && (
            <p className="mt-2 text-sm text-ink-mute flex items-center gap-2">
              <Stars rating={avg} />
              <span>{avg.toFixed(1)} · {reviews.length} {reviews.length === 1 ? "reseña" : "reseñas"}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="shrink-0 rounded-full liquid-glass border border-line px-4 py-2 text-sm hover:border-gold/40"
        >
          {showForm ? "Cancelar" : "+ Escribir reseña"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="liquid-glass rounded-2xl p-5 sm:p-6 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Tu nombre *</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold"
                required
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-gold/80">Email (opcional)</span>
              <input
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold"
              />
            </label>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Tu valoración</span>
            <div className="mt-1.5 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl transition-colors ${n <= rating ? "text-gold" : "text-ink-mute/40 hover:text-gold/60"}`}
                  aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Título (opcional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold"
              placeholder="Una frase que resuma tu experiencia"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gold/80">Comentario *</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full mt-1 bg-black/40 border border-line rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold resize-y"
              placeholder="¿Qué te gustó? ¿Cómo te hizo sentir? ¿Cuánto dura?"
            />
          </label>
          <p className="text-[11px] text-ink-mute">
            Tu reseña será revisada por nuestro equipo antes de publicarse.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-gold text-bg px-5 py-2.5 text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Enviar reseña"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-mute">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-6 text-center">
          <p className="font-display italic text-xl text-ink">Aún no hay reseñas</p>
          <p className="mt-2 text-sm text-ink-mute">Sé el primero en compartir tu experiencia con esta fragancia.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="liquid-glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-ink font-medium flex items-center gap-2">
                    {r.author_name}
                    {r.verified_purchase && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
                        ✓ Compra verificada
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-mute">
                    {new Date(r.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.title && <p className="mt-2 font-medium text-ink">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm text-ink/90 leading-relaxed whitespace-pre-line">{r.body}</p>}
              {r.admin_response && (
                <div className="mt-3 ml-3 pl-3 border-l-2 border-gold/40 text-sm">
                  <p className="text-[11px] uppercase tracking-wider text-gold/80">Respuesta de Polianthes</p>
                  <p className="mt-1 text-ink/90">{r.admin_response}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${rating.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`text-sm ${n <= Math.round(rating) ? "text-gold" : "text-ink-mute/30"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

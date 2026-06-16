"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Email = {
  id: number;
  direction: "outbound" | "inbound";
  kind: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  to_email: string;
  from_email: string;
  provider: string | null;
  provider_message_id: string | null;
  ok: boolean;
  error: string | null;
  sent_at: string;
  sent_by: string | null;
};

type OrderHeader = {
  id: number;
  public_id: string;
  customer_email: string;
  customer_name: string;
};

const KIND_META: Record<string, { label: string; color: string; icon: string }> = {
  manual: { label: "Mensaje", color: "text-gold border-gold/30 bg-gold/10", icon: "✉" },
  confirmation: { label: "Confirmación", color: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10", icon: "✓" },
  shipped: { label: "Envío", color: "text-sky-300 border-sky-300/30 bg-sky-400/10", icon: "📦" },
  delivered: { label: "Entrega", color: "text-gold border-gold/30 bg-gold/10", icon: "🎁" },
  cancelled: { label: "Cancelación", color: "text-rose-300 border-rose-300/30 bg-rose-400/10", icon: "✕" },
  refunded: { label: "Reembolso", color: "text-violet-300 border-violet-300/30 bg-violet-400/10", icon: "↩" },
  approved: { label: "Aprobado", color: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10", icon: "✓" },
  in_transit: { label: "En tránsito", color: "text-sky-300 border-sky-300/30 bg-sky-400/10", icon: "📦" },
  status_update: { label: "Cambio de estado", color: "text-ink-mute border-white/10 bg-white/5", icon: "↻" },
  system: { label: "Sistema", color: "text-ink-mute border-white/10 bg-white/5", icon: "⚙" }
};

const QUICK_TEMPLATES: { id: string; label: string; subject: string; body: string }[] = [
  {
    id: "thanks",
    label: "🙏 Agradecimiento",
    subject: "Gracias por tu compra",
    body: "Gracias por elegir Polianthes. Esperamos que disfrutes mucho tu nueva fragancia.\n\nSi tienes cualquier duda o quieres compartir tu experiencia, estamos a un email de distancia.\n\nCon cariño,\nEquipo Polianthes"
  },
  {
    id: "delay",
    label: "⏱ Aviso de retraso",
    subject: "Actualización sobre tu pedido",
    body: "Queremos avisarte que tu pedido está tardando un poco más de lo habitual en prepararse. Te mantendremos informada(o) en cuanto sea enviado.\n\nDisculpa las molestias y gracias por tu paciencia.\n\nEquipo Polianthes"
  },
  {
    id: "out_of_stock",
    label: "⚠ Falta de stock",
    subject: "Sobre la disponibilidad de tu pedido",
    body: "Lamentamos informarte que uno de los productos de tu pedido no está disponible en este momento. Te ofrecemos las siguientes opciones:\n\n• Reembolso del importe correspondiente\n• Sustitución por una fragancia similar (te recomendamos…)\n• Esperar a que vuelva a estar disponible\n\nPor favor, responde este email con la opción que prefieras.\n\nEquipo Polianthes"
  },
  {
    id: "tracking",
    label: "📦 Envío con guía",
    subject: "Tu pedido ya tiene número de guía",
    body: "Tu pedido ha sido enviado. Aquí tienes los datos de seguimiento:\n\nGuía: [NÚMERO]\nPaquetería: [TRANSPORTISTA]\n\nPuedes rastrearlo desde: [URL]\n\nGracias por tu compra.\n\nEquipo Polianthes"
  },
  {
    id: "address",
    label: "📍 Confirmar dirección",
    subject: "¿Confirmamos tu dirección de envío?",
    body: "Antes de procesar tu pedido, queremos confirmar la dirección de envío registrada:\n\n[DIRECCIÓN]\n\n¿Es correcta? Si necesitas algún ajuste, por favor responde este email con la dirección actualizada.\n\nEquipo Polianthes"
  }
];

export default function EmailThread({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderHeader | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/emails`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setOrder(data.order);
      setEmails(data.emails ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar emails");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  function applyTemplate(t: typeof QUICK_TEMPLATES[number]) {
    setSubject(t.subject);
    setBody(t.body);
  }

  function buildHtml(plainBody: string): string {
    const safeBody = plainBody
      .split("\n\n")
      .map((p) => `<p style="color:#f5f5f5;font-size:14px;line-height:1.6;margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    return `
      <div style="font-family:Georgia,serif;background:#0c0c0c;color:#f5f5f5;padding:32px 24px;max-width:560px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-style:italic;font-size:28px;color:#d4af37;margin:0;">Polianthes</h1>
          <p style="color:#666;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Perfumería de autor</p>
        </div>
        <div style="background:#141414;border-radius:12px;padding:24px;border:1px solid #222;">
          ${safeBody}
        </div>
        <div style="text-align:center;color:#666;font-size:11px;padding:16px 0 0;border-top:1px solid #222;margin-top:24px;">
          <p>Polianthes © ${new Date().getFullYear()}</p>
        </div>
      </div>
    `.trim();
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Asunto y mensaje son obligatorios");
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/emails/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          html: buildHtml(body),
          text: body
        })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.message ?? "Error al enviar");
      toast.success(`Email enviado a ${order?.customer_email}`);
      setSubject(""); setBody(""); setOpen(false);
      load();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  async function resendConfirmation() {
    setResending(true);
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/resend-confirmation`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display italic text-xl text-ink">Comunicación con el cliente</h2>
          <p className="text-[11px] text-ink-mute mt-1">
            Hilo de emails enviados a <span className="text-gold">{order?.customer_email ?? "…"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={resendConfirmation}
            disabled={resending}
            className="rounded-full liquid-glass border border-line px-3 py-1.5 text-xs hover:border-gold/40 disabled:opacity-50"
            title="Reenvía la confirmación de pago original"
          >
            {resending ? "Reenviando…" : "↺ Reenviar confirmación"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-gold text-bg px-3 py-1.5 text-xs font-medium hover:bg-gold/90"
          >
            {open ? "Cancelar" : "✉ Nuevo email"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mb-4 p-4 rounded-xl bg-black/30 border border-line space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Plantillas rápidas</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="rounded-full px-2.5 py-1 text-[11px] border border-line/40 text-ink/70 hover:text-gold hover:border-gold/30 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Asunto</p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
              placeholder="Asunto del email"
              maxLength={200}
            />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gold/80 mb-1.5">Mensaje</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold resize-y font-mono"
              placeholder="Escribe el mensaje para el cliente… (los saltos de línea se respetan)"
            />
            <p className="mt-1 text-[10px] text-ink-mute">Se enviará a {order?.customer_email}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setSubject(""); setBody(""); }}
              disabled={sending}
              className="rounded-full liquid-glass border border-line px-3 py-1.5 text-xs hover:border-gold/40 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={send}
              disabled={sending || !subject.trim() || !body.trim()}
              className="rounded-full bg-gold text-bg px-4 py-1.5 text-xs font-medium hover:bg-gold/90 disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar email"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-ink-mute py-4">Cargando hilo…</p>
      ) : emails.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-ink-mute">Aún no se han enviado emails a este cliente.</p>
          <p className="text-[11px] text-ink-mute mt-1">Usa "Reenviar confirmación" o "Nuevo email" para empezar.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {emails.map((e) => {
            const meta = KIND_META[e.kind] ?? KIND_META.system;
            const expanded = expandedId === e.id;
            return (
              <li
                key={e.id}
                className="rounded-xl border border-line/40 bg-black/20 hover:bg-black/30 transition-colors overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-3"
                >
                  <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${meta.color}`}>
                        {meta.label}
                      </span>
                      {!e.ok && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-rose-300/30 bg-rose-400/10 text-rose-300">
                          Error
                        </span>
                      )}
                      <span className="text-[11px] text-ink-mute ml-auto whitespace-nowrap">
                        {new Date(e.sent_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-sm text-ink mt-1 truncate">{e.subject}</p>
                    <p className="text-[10px] text-ink-mute mt-0.5">
                      {e.sent_by && e.sent_by !== "system" && <span className="text-gold/60">por {e.sent_by} · </span>}
                      {e.provider && <span>vía {e.provider}</span>}
                      {e.provider_message_id && <span className="ml-1 font-mono text-[9px]">({e.provider_message_id.slice(0, 12)}…)</span>}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-line/40 bg-black/40 p-4">
                    {!e.ok && e.error && (
                      <div className="mb-3 p-2 rounded bg-rose-400/10 border border-rose-300/30 text-rose-300 text-xs">
                        <strong>Error:</strong> {e.error}
                      </div>
                    )}
                    <div
                      className="bg-white text-black rounded-lg p-4 text-sm max-h-80 overflow-y-auto"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: e.body_html }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

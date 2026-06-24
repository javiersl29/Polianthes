import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacto · Polianthes",
  description: "Contáctanos para resolver tus dudas sobre pedidos, fragancias y más."
};

type Pickup = {
  id: number;
  name: string;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_schedule: string | null;
  phone: string | null;
  email: string | null;
};

export default async function ContactoPage() {
  const pickupRes = await query<Pickup>(
    `SELECT id, name, pickup_address, pickup_city, pickup_state,
            pickup_schedule, phone, email
     FROM shipping_zone WHERE kind = 'pickup' AND active = TRUE
     ORDER BY display_order, name`
  );
  const pickups = pickupRes.rows;

  return (
    <InfoPageShell
      eyebrow="Ayuda"
      title="Contacto"
      intro="Estamos para ayudarte. Escríbenos y te respondemos lo antes posible."
      cta={{ label: "Enviar correo", href: "mailto:ventas@polianthes.shop?subject=Consulta%20general" }}
      sections={[
        {
          title: "Correo electrónico",
          icon: <IconMail />,
          content: (
            <div className="space-y-1">
              <p>Nuestro correo principal es <strong className="text-gold">ventas@polianthes.shop</strong>.</p>
              <p>Tiempo de respuesta: <strong className="text-ink">24-48 horas hábiles</strong>.</p>
              <p>Para una atención más rápida, incluye tu número de pedido si ya hiciste una compra.</p>
            </div>
          )
        },
        {
          title: "Asuntos sugeridos",
          icon: <IconList />,
          content: (
            <div className="space-y-1">
              <p>Para ayudarte mejor, usa estos asuntos en tu correo:</p>
              <p>• <strong className="text-ink">Consulta sobre pedido</strong> — estado, modificación o cancelación.</p>
              <p>• <strong className="text-ink">Solicitud de devolución</strong> — para procesar una devolución.</p>
              <p>• <strong className="text-inline">Consulta sobre fragancias</strong> — recomendaciones, notas, familias olfativas.</p>
              <p>• <strong className="text-ink">Consulta sobre envíos</strong> — zonas, tiempos, costos.</p>
            </div>
          )
        },
        ...(pickups.length > 0 ? [{
          title: "Sitios físicos",
          icon: <IconPin />,
          content: (
            <div className="space-y-2">
              <p>Puedes visitarnos en nuestros puntos de entrega:</p>
              {pickups.map((p) => (
                <div key={p.id} className="border border-line/40 rounded-xl p-3">
                  <p className="text-ink font-medium text-sm">{p.name}</p>
                  {p.pickup_address && <p className="text-xs mt-0.5">{p.pickup_address}{p.pickup_city ? `, ${p.pickup_city}` : ""}{p.pickup_state ? `, ${p.pickup_state}` : ""}</p>}
                  {p.pickup_schedule && <p className="text-xs text-gold/70 mt-0.5">🕘 {p.pickup_schedule}</p>}
                  {p.phone && <p className="text-xs mt-0.5">📞 {p.phone}</p>}
                  {p.email && <p className="text-xs mt-0.5">✉ {p.email}</p>}
                </div>
              ))}
            </div>
          )
        }] : []),
        {
          title: "Redes sociales",
          icon: <IconShare />,
          content: (
            <p>Próximamente estaremos disponibles en redes sociales. Mientras tanto, el mejor canal de contacto es nuestro correo electrónico.</p>
          )
        }
      ]}
    />
  );
}

function IconMail() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>; }
function IconList() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
function IconPin() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
function IconShare() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>; }

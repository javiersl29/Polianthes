import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Envíos y entregas · Polianthes",
  description: "Envíos a todo México. Conoce tiempos, costos y puntos de entrega física."
};

type Pickup = {
  id: number;
  name: string;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_schedule: string | null;
  phone: string | null;
};

type ShipConfig = {
  default_cost_cents: number;
  default_free_from_cents: number | null;
  default_estimated_days: string | null;
};

export default async function EnviosPage() {
  const pickupRes = await query<Pickup>(
    `SELECT id, name, pickup_address, pickup_city, pickup_state,
            pickup_postal_code, pickup_schedule, phone
     FROM shipping_zone WHERE kind = 'pickup' AND active = TRUE
     ORDER BY display_order, name`
  );
  const pickups = pickupRes.rows;

  const cfgRes = await query<ShipConfig>(
    `SELECT default_cost_cents, default_free_from_cents, default_estimated_days
     FROM shipping_config WHERE id = 1`
  );
  const cfg = cfgRes.rows[0];
  const shippingCost = cfg ? `$${(cfg.default_cost_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "—";
  const freeFrom = cfg?.default_free_from_cents
    ? `$${(cfg.default_free_from_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
    : null;
  const estimatedDays = cfg?.default_estimated_days ?? "3-5 días hábiles";

  return (
    <InfoPageShell
      eyebrow="Ayuda"
      title="Envíos y entregas"
      intro="Hacemos envíos a todo México. Cada fragancia se prepara y empaca con cuidado para garantizar que llegue en perfectas condiciones."
      cta={{ label: "Consultar por envío", href: "mailto:ventas@polianthes.shop?subject=Consulta%20sobre%20env%C3%ADos" }}
      sections={[
        {
          title: "Cómo funciona",
          icon: <IconBox />,
          content: (
            <ol className="space-y-2">
              <li><strong className="text-ink">1. Haces tu pedido.</strong> Completa tu compra en línea y recibe confirmación por correo.</li>
              <li><strong className="text-ink">2. Preparamos tu orden.</strong> Empacamos tus fragancias con protección adecuada en 1-2 días hábiles.</li>
              <li><strong className="text-ink">3. Lo recibes.</strong> Te llega a la puerta de tu casa o lo recoges en nuestro punto de entrega.</li>
            </ol>
          )
        },
        {
          title: "Cobertura y tiempos",
          icon: <IconTruck />,
          content: (
            <div className="space-y-1">
              <p>Cubrimos <strong className="text-ink">todo México</strong> mediante paquetería nacional.</p>
              <p>Tiempo estimado de entrega: <strong className="text-gold">{estimatedDays}</strong> después de la confirmación del pago.</p>
              <p>Costo de envío estándar: <strong className="text-gold">{shippingCost}</strong> MXN.</p>
            </div>
          )
        },
        ...(freeFrom ? [{
          title: "Envío gratis",
          icon: <IconGift />,
          content: (
            <p>Los pedidos superiores a <strong className="text-gold">{freeFrom}</strong> MXN tienen <strong className="text-ink">envío gratis</strong> a todo el país. El descuento se aplica automáticamente en el checkout.</p>
          )
        }] : []),
        ...(pickups.length > 0 ? [{
          title: "Sitios de entrega física",
          icon: <IconPin />,
          content: (
            <div className="space-y-3">
              <p>Puedes recoger tu pedido sin costo de envío en nuestros puntos de entrega:</p>
              {pickups.map((p) => (
                <div key={p.id} className="border border-line/40 rounded-xl p-3">
                  <p className="text-ink font-medium text-sm">{p.name}</p>
                  {p.pickup_address && <p className="text-xs mt-0.5">{p.pickup_address}{p.pickup_city ? `, ${p.pickup_city}` : ""}{p.pickup_state ? `, ${p.pickup_state}` : ""} {p.pickup_postal_code}</p>}
                  {p.pickup_schedule && <p className="text-xs text-gold/70 mt-0.5">🕘 {p.pickup_schedule}</p>}
                  {p.phone && <p className="text-xs mt-0.5">📞 {p.phone}</p>}
                </div>
              ))}
            </div>
          )
        }] : []),
        {
          title: "Preguntas frecuentes",
          icon: <IconQuestion />,
          content: (
            <div className="space-y-3">
              <div>
                <p className="text-ink font-medium text-xs">¿Hacen envíos internacionales?</p>
                <p className="text-xs">Por ahora solo enviamos dentro de México.</p>
              </div>
              <div>
                <p className="text-ink font-medium text-xs">¿Puedo cambiar mi dirección de envío?</p>
                <p className="text-xs">Sí, mientras el pedido no haya sido enviado. Escríbenos lo antes posible.</p>
              </div>
              <div>
                <p className="text-ink font-medium text-xs">¿Qué paquetería utilizan?</p>
                <p className="text-xs">Trabajamos con paqueterías nacionales reconocidas (DHL, FedEx, Estafeta o Quetzal) según la zona.</p>
              </div>
              <div>
                <p className="text-ink font-medium text-xs">¿Cómo rastreo mi pedido?</p>
                <p className="text-xs">Una vez enviado, recibirás el número de guía por correo electrónico.</p>
              </div>
              <div>
                <p className="text-ink font-medium text-xs">¿Qué pasa si no estoy en casa cuando llega?</p>
                <p className="text-xs">La paquetería dejará un aviso o te contactará para reagendar la entrega.</p>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

function IconBox() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>; }
function IconTruck() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>; }
function IconGift() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>; }
function IconPin() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
function IconQuestion() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>; }

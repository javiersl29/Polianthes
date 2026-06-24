import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Política de devoluciones · Polianthes",
  description: "Conoce nuestra política de devoluciones, reembolsos y cambios."
};

export default function DevolucionesPage() {
  return (
    <InfoPageShell
      eyebrow="Ayuda"
      title="Devoluciones"
      intro="Tu satisfacción es nuestra prioridad. Si algo no está bien con tu pedido, estamos para resolverlo."
      cta={{ label: "Solicitar devolución", href: "mailto:ventas@polianthes.shop?subject=Solicitud%20de%20devoluci%C3%B3n" }}
      sections={[
        {
          title: "Política general",
          icon: <IconShield />,
          content: (
            <div className="space-y-1">
              <p>Aceptamos devoluciones dentro de los <strong className="text-gold">30 días naturales</strong> posteriores a la entrega.</p>
              <p>El producto debe estar <strong className="text-ink">sellado, sin usar y en su empaque original</strong>.</p>
              <p>Los perfumes abiertos o utilizados no son elegibles para devolución por razones de higiene y seguridad.</p>
            </div>
          )
        },
        {
          title: "Proceso de devolución",
          icon: <IconSteps />,
          content: (
            <ol className="space-y-2">
              <li><strong className="text-ink">1. Contáctanos.</strong> Envíanos un correo a ventas@polianthes.shop con tu número de pedido y el motivo de la devolución.</li>
              <li><strong className="text-ink">2. Aprobación.</strong> Revisamos tu solicitud en 24-48 horas hábiles y te confirmamos por correo.</li>
              <li><strong className="text-ink">3. Envío.</strong> Empaca el producto en su empaque original y envíalo a la dirección que te indicaremos.</li>
              <li><strong className="text-ink">4. Reembolso.</strong> Al recibir y verificar el producto, procesamos tu reembolso.</li>
            </ol>
          )
        },
        {
          title: "¿Qué se puede devolver?",
          icon: <IconCheck />,
          content: (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-emerald-300 font-medium text-xs mb-1">✓ Sí se puede</p>
                <ul className="text-xs space-y-0.5">
                  <li>• Producto sellado y sin abrir</li>
                  <li>• Empaque original en buen estado</li>
                  <li>• Con defecto de fábrica</li>
                  <li>• Pedido equivocado (error nuestro)</li>
                </ul>
              </div>
              <div>
                <p className="text-rose-300 font-medium text-xs mb-1">✗ No se puede</p>
                <ul className="text-xs space-y-0.5">
                  <li>• Perfume abierto o usado</li>
                  <li>• Daño por uso incorrecto</li>
                  <li>• Pasados los 30 días</li>
                  <li>• Productos en promoción liquidada</li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: "Reembolsos",
          icon: <IconWallet />,
          content: (
            <div className="space-y-1">
              <p>El reembolso se procesa en <strong className="text-gold">5-10 días hábiles</strong> después de recibir y verificar el producto.</p>
              <p>Se realiza por el <strong className="text-ink">mismo método de pago</strong> que utilizaste en la compra (Mercado Pago o tarjeta).</p>
              <p>Los gastos de envío de la devolución corren por cuenta del cliente, excepto cuando el motivo sea defecto de fábrica o error de nuestro lado.</p>
            </div>
          )
        },
        {
          title: "Cambios",
          icon: <IconSwap />,
          content: (
            <p>¿Quieres cambiar tu fragancia por otra o por otro tamaño? Los cambios se aceptan bajo las mismas condiciones que las devoluciones (producto sellado, sin usar, dentro de 30 días). Contáctanos para coordinar el cambio y los costos de envío correspondientes.</p>
          )
        },
        {
          title: "Defectos o daño en envío",
          icon: <IconAlert />,
          content: (
            <div className="space-y-1">
              <p>Si recibes un producto dañado o con defecto de fábrica:</p>
              <p>1. Toma fotos del producto y el empaque dentro de las <strong className="text-gold">48 horas</strong> siguientes a la entrega.</p>
              <p>2. Envíanos las fotos a ventas@polianthes.shop con tu número de pedido.</p>
              <p>3. Te enviaremos un reemplazo <strong className="text-ink">sin costo</strong> o un reembolso completo, según tu preferencia.</p>
            </div>
          )
        }
      ]}
    />
  );
}

function IconShield() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function IconSteps() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M5 12a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2M5 12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" /><path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></svg>; }
function IconCheck() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>; }
function IconWallet() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg>; }
function IconSwap() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M8 21H3v-5M21 3l-7 7M3 21l7-7" /></svg>; }
function IconAlert() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>; }

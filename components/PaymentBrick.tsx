"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Tipos mínimos para el SDK de Mercado Pago cargado vía CDN
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago?: any;
  }
}

type Props = {
  publicKey: string;
  preferenceId: string | null;
  amount: number;
  orderId: number;
  publicId: string;
  onPaid: (result: { status: string; payment_id: number; public_id: string }) => void;
};

/**
 * Wrapper del Payment Brick de Mercado Pago.
 * Carga el SDK desde CDN, inicializa el BrickBuilder y renderiza
 * el Payment Brick dentro de un div.
 *
 * Flujo onSubmit: el brick envía formData (con token de tarjeta),
 * lo mandamos a nuestro /api/checkout/bricks/process que crea el pago
 * en MP y devuelve el resultado.
 */
export default function PaymentBrick({ publicKey, preferenceId, amount, orderId, publicId, onPaid }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<{ unmount: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBrick() {
      try {
        // 1) Cargar SDK si no está
        if (!window.MercadoPago) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://sdk.mercadopago.com/js/v2";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("No se pudo cargar el SDK de Mercado Pago"));
            document.body.appendChild(script);
          });
        }

        if (cancelled) return;

        // 2) Inicializar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp = new (window as any).MercadoPago(publicKey, { locale: "es-MX" });
        const bricksBuilder = await mp.bricks();

        if (cancelled) return;

        // 3) Crear settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings: any = {
          initialization: {
            amount,
            ...(preferenceId ? { preferenceId } : {})
          },
          customization: {
            paymentMethods: {
              atm: "all",
              ticket: "all",
              creditCard: "all",
              prepaidCard: "all",
              debitCard: "all",
              mercadoPago: "all"
            },
            visual: {
              style: {
                theme: "dark"
              }
            }
          },
          callbacks: {
            onReady: () => {
              setLoading(false);
            },
            onSubmit: ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: Record<string, unknown>; formData: Record<string, unknown> }) => {
              const payload = {
                formData: formData ?? {},
                selectedPaymentMethod: selectedPaymentMethod ?? {},
                order_id: orderId,
                public_id: publicId
              };
              console.log("[PaymentBrick] onSubmit", { selectedPaymentMethod, formData });
              return new Promise<void>((resolve, reject) => {
                fetch("/api/checkout/bricks/process", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                })
                  .then((r) => r.json())
                  .then((data) => {
                    if (data.error) {
                      toast.error(data.error);
                      reject();
                      return;
                    }
                    // El brick usa resolve/reject para decidir si muestra
                    // la pantalla de éxito o error.
                    if (data.status === "approved" || data.status === "pending") {
                      resolve();
                      // Notificar al parent para que redirija si quiere
                      onPaid({
                        status: data.status,
                        payment_id: data.payment_id,
                        public_id: data.public_id
                      });
                    } else {
                      toast.error(`Pago ${data.status}: ${data.status_detail ?? ""}`);
                      reject();
                    }
                  })
                  .catch((err) => {
                    toast.error("Error de conexión con el servidor");
                    reject(err);
                  });
              });
            },
            onError: (error: unknown) => {
              console.error("Brick error:", error);
              setError("Ocurrió un error en el formulario de pago");
            }
          }
        };

        // 4) Renderizar brick
        controllerRef.current = await bricksBuilder.create("payment", "payment-brick-container", settings);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando el formulario de pago");
          setLoading(false);
        }
      }
    }

    loadBrick();

    return () => {
      cancelled = true;
      // Limpiar brick al desmontar
      if (controllerRef.current) {
        try { controllerRef.current.unmount(); } catch { /* noop */ }
      }
    };
  }, [publicKey, preferenceId, amount, orderId, publicId, onPaid]);

  return (
    <div className="liquid-glass rounded-2xl p-4 sm:p-5">
      {loading && (
        <div className="py-8 text-center text-sm text-ink-mute animate-pulse">
          Cargando formulario de pago…
        </div>
      )}
      {error && (
        <div className="py-8 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <p className="mt-2 text-xs text-ink-mute">
            Verifica que las credenciales de Mercado Pago estén bien en /admin/pagos
          </p>
        </div>
      )}
      <div id="payment-brick-container" ref={containerRef} />
    </div>
  );
}

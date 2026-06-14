import { query } from "./db";

type EmailConfig = {
  provider: "resend" | "smtp" | "none";
  from_email: string;
  from_name: string;
  resend_api_key: string | null;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
  active: boolean;
};

async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const r = await query<EmailConfig>(`SELECT * FROM email_config WHERE id = 1`);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Envía un email de confirmación de pedido al cliente.
 * Usa Resend API (recomendado) o SMTP según la config de la DB.
 * No lanza errores: si falla, sólo loggea.
 */
export async function sendOrderConfirmationEmail(orderId: number): Promise<void> {
  const config = await getEmailConfig();
  if (!config || !config.active || config.provider === "none") {
    console.log("[email] Email no activo, saltando confirmación para orden", orderId);
    return;
  }

  // Cargar datos completos de la orden
  const orderRes = await query<{
    public_id: string;
    status: string;
    customer_email: string;
    customer_name: string;
    total_cents: number;
    currency: string;
    shipping_zone_name: string;
    shipping_address_line: string;
    shipping_city: string;
    shipping_state: string;
    shipping_postal_code: string;
  }>(
    `SELECT public_id, status, customer_email, customer_name, total_cents, currency,
            shipping_zone_name, shipping_address_line, shipping_city, shipping_state,
            shipping_postal_code
     FROM "order" WHERE id = $1`,
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order) return;

  const itemsRes = await query<{
    fragrance_brand: string;
    fragrance_name: string;
    size_ml: number;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>(
    `SELECT fragrance_brand, fragrance_name, size_ml, qty, unit_price_cents, line_total_cents
     FROM order_item WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );

  const itemsHtml = itemsRes.rows.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #333;">
        ${it.fragrance_brand} · ${it.fragrance_name}<br>
        <span style="color:#999;font-size:12px;">${it.size_ml}ml × ${it.qty}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #333;text-align:right;color:#d4af37;">
        $${(it.line_total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
      </td>
    </tr>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;background:#141414;color:#f5f5f5;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-style:italic;font-size:32px;color:#d4af37;margin:0;">Polianthes</h1>
      <p style="color:#999;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Perfumería de autor</p>
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(76,217,100,0.15);border:2px solid rgba(76,217,100,0.4);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#4cd964;font-size:28px;">✓</span>
      </div>
      <h2 style="font-style:italic;font-size:24px;color:#f5f5f5;margin:0;">¡Gracias por tu compra!</h2>
      <p style="color:#999;font-size:14px;margin-top:8px;">Recibimos tu pago y estamos preparando tu pedido.</p>
    </div>

    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Pedido</p>
      <p style="font-size:18px;color:#d4af37;margin:0 0 16px;font-family:monospace;">${order.public_id}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${itemsHtml}
      </table>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #333;display:flex;justify-content:space-between;">
        <span style="font-size:16px;color:#f5f5f5;">Total pagado</span>
        <span style="font-size:20px;color:#d4af37;font-weight:bold;">
          $${(order.total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} ${order.currency}
        </span>
      </div>
    </div>

    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Entrega</p>
      <p style="font-size:14px;color:#f5f5f5;margin:0;">
        ${order.customer_name}<br>
        ${order.shipping_address_line}<br>
        ${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}<br>
        <span style="color:#999;">Zona: ${order.shipping_zone_name}</span>
      </p>
    </div>

    <div style="text-align:center;color:#666;font-size:12px;padding:16px 0;">
      <p>Si tienes preguntas sobre tu pedido, escríbenos a<br>
      <a href="mailto:ventas@polianthes.mx" style="color:#d4af37;">ventas@polianthes.mx</a></p>
      <p style="margin-top:16px;opacity:0.5;">Polianthes © ${new Date().getFullYear()} · Perfumería de autor</p>
      <p style="font-size:10px;opacity:0.4;margin-top:8px;">
        Las fragancias Polianthes no están afiliadas ni respaldadas por las casas mencionadas.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Polianthes — Pedido ${order.public_id}\n\n¡Gracias por tu compra, ${order.customer_name}!\n\nTu pago fue aprobado. Estamos preparando tu pedido.\n\nTotal: $${(order.total_cents / 100).toLocaleString("es-MX")} ${order.currency}\nEntrega: ${order.shipping_address_line}, ${order.shipping_city}\n\nSi tienes preguntas, escríbenos a ventas@polianthes.mx`;

  const from = `${config.from_name} <${config.from_email}>`;
  const subject = `¡Pago confirmado! Pedido ${order.public_id}`;

  try {
    if (config.provider === "resend" && config.resend_api_key) {
      await sendViaResend(config.resend_api_key, from, order.customer_email, subject, html, text);
      console.log(`[email] Confirmación enviada a ${order.customer_email} vía Resend (orden ${order.public_id})`);
    } else if (config.provider === "smtp" && config.smtp_host) {
      await sendViaSmtp(config, from, order.customer_email, subject, html, text);
      console.log(`[email] Confirmación enviada a ${order.customer_email} vía SMTP (orden ${order.public_id})`);
    } else {
      console.log("[email] Provider no configurado, saltando");
    }
  } catch (e) {
    console.error("[email] Error enviando:", e instanceof Error ? e.message : e);
  }
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend ${r.status}: ${err.slice(0, 200)}`);
  }
}

async function sendViaSmtp(
  config: EmailConfig,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  // SMTP dinámico para no añadir dependencia pesada al bundle
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: config.smtp_host!,
    port: config.smtp_port,
    secure: config.smtp_secure,
    auth: config.smtp_user
      ? { user: config.smtp_user, pass: config.smtp_password ?? "" }
      : undefined
  });
  await transporter.sendMail({ from, to, subject, html, text });
}

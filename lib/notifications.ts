import { query } from "./db";

type NotificationConfig = {
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
  admin_email: string | null;
  notify_admin_new_order: boolean;
  notify_customer_confirmation: boolean;
  notify_customer_shipped: boolean;
};

export async function getNotificationConfig(): Promise<NotificationConfig | null> {
  try {
    const r = await query<NotificationConfig>(`SELECT * FROM email_config WHERE id = 1`);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Envío base
// ────────────────────────────────────────────────────────────

async function sendEmail(
  config: NotificationConfig,
  to: string | string[],
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; message: string }> {
  const from = `${config.from_name} <${config.from_email}>`;
  const recipients = Array.isArray(to) ? to : [to];

  if (config.provider === "resend" && config.resend_api_key) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ from, to: recipients, subject, html, text }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        const errText = await r.text();
        let parsed: { message?: string; name?: string } = {};
        try { parsed = JSON.parse(errText); } catch { /* */ }
        return {
          ok: false,
          message: parsed.message ?? `Resend error ${r.status}: ${errText.slice(0, 300)}`
        };
      }
      return { ok: true, message: `Enviado a ${recipients.join(", ")} vía Resend` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Error Resend" };
    }
  }

  if (config.provider === "smtp" && config.smtp_host) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtp_host!,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: config.smtp_user
          ? { user: config.smtp_user, pass: config.smtp_password ?? "" }
          : undefined
      });
      await transporter.sendMail({ from, to: recipients.join(","), subject, html, text });
      return { ok: true, message: `Enviado a ${recipients.join(", ")} vía SMTP` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Error SMTP" };
    }
  }

  return { ok: false, message: "Proveedor no configurado" };
}

// ────────────────────────────────────────────────────────────
// Notificaciones al CLIENTE
// ────────────────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(orderId: number): Promise<void> {
  const config = await getNotificationConfig();
  if (!config || !config.active || !config.notify_customer_confirmation) return;

  const order = await loadOrder(orderId);
  if (!order) return;

  const itemsHtml = order.items.map((it) => `
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

  const html = emailTemplate({
    title: "¡Gracias por tu compra!",
    icon: "✓",
    iconColor: "#4cd964",
    body: `
      <p style="color:#999;font-size:14px;margin-top:8px;">Recibimos tu pago y estamos preparando tu pedido.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Pedido</p>
        <p style="font-size:18px;color:#d4af37;margin:0 0 16px;font-family:monospace;">${order.public_id}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemsHtml}</table>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #333;display:flex;justify-content:space-between;">
          <span style="font-size:16px;color:#f5f5f5;">Total pagado</span>
          <span style="font-size:20px;color:#d4af37;font-weight:bold;">$${(order.total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} ${order.currency}</span>
        </div>
      </div>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Entrega</p>
        <p style="font-size:14px;color:#f5f5f5;margin:0;">${order.customer_name}<br>${order.shipping_address_line}<br>${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}<br><span style="color:#999;">Zona: ${order.shipping_zone_name}</span></p>
      </div>
    `,
    footer: "Si tienes preguntas, escríbenos a ventas@polianthes.mx"
  });

  await sendEmail(
    config,
    order.customer_email,
    `¡Pago confirmado! Pedido ${order.public_id}`,
    html,
    `Polianthes — Pedido ${order.public_id} confirmado. Total: $${(order.total_cents / 100).toLocaleString("es-MX")} ${order.currency}`
  );
}

export async function sendShippedNotification(orderId: number, carrier: string | null, trackingNumber: string | null): Promise<void> {
  const config = await getNotificationConfig();
  if (!config || !config.active || !config.notify_customer_shipped) return;

  const order = await loadOrder(orderId);
  if (!order) return;

  const trackingHtml = trackingNumber
    ? `<p style="font-size:16px;color:#d4af37;margin:8px 0;">📦 Guía: <strong>${trackingNumber}</strong>${carrier ? ` (${carrier})` : ""}</p>`
    : "";

  const html = emailTemplate({
    title: "¡Tu pedido está en camino!",
    icon: "📦",
    iconColor: "#d4af37",
    body: `
      <p style="color:#999;font-size:14px;">Tu pedido <strong style="color:#d4af37;">${order.public_id}</strong> fue enviado.</p>
      ${trackingHtml}
      <p style="color:#999;font-size:13px;margin-top:16px;">Pronto lo recibirás en: ${order.shipping_address_line}, ${order.shipping_city}</p>
    `,
    footer: "Si tienes preguntas, escríbenos a ventas@polianthes.mx"
  });

  await sendEmail(config, order.customer_email, `Tu pedido ${order.public_id} fue enviado`, html, "");
}

// ────────────────────────────────────────────────────────────
// Notificaciones al ADMINISTRADOR
// ────────────────────────────────────────────────────────────

export async function sendAdminNewOrderNotification(orderId: number): Promise<void> {
  const config = await getNotificationConfig();
  if (!config || !config.active || !config.notify_admin_new_order || !config.admin_email) return;

  const order = await loadOrder(orderId);
  if (!order) return;

  const itemsHtml = order.items.map((it) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #333;">${it.fragrance_brand} · ${it.fragrance_name} (${it.size_ml}ml × ${it.qty})</td>
      <td style="padding:6px 0;border-bottom:1px solid #333;text-align:right;color:#d4af37;">$${(it.line_total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
    </tr>
  `).join("");

  const html = emailTemplate({
    title: "🛎 Nuevo pedido recibido",
    icon: "🛎",
    iconColor: "#d4af37",
    body: `
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:16px 0;">
        <p style="color:#999;font-size:11px;text-transform:uppercase;margin:0 0 4px;">Pedido</p>
        <p style="font-size:18px;color:#d4af37;margin:0 0 16px;font-family:monospace;">${order.public_id}</p>
        <p style="color:#f5f5f5;margin:0 0 4px;"><strong>Cliente:</strong> ${order.customer_name}</p>
        <p style="color:#999;margin:0 0 16px;">${order.customer_email}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${itemsHtml}</table>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #333;display:flex;justify-content:space-between;">
          <span style="color:#f5f5f5;">Total</span>
          <span style="color:#d4af37;font-weight:bold;">$${(order.total_cents / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} ${order.currency}</span>
        </div>
      </div>
      <p style="text-align:center;">
        <a href="https://polianthes.up.railway.app/admin/pedidos/${orderId}" style="color:#d4af37;">Ver pedido en el panel →</a>
      </p>
    `,
    footer: "Notificación automática de Polianthes"
  });

  await sendEmail(config, config.admin_email, `🛎 Nuevo pedido ${order.public_id}`, html, "");
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

type OrderData = {
  public_id: string;
  customer_email: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  shipping_zone_name: string;
  shipping_address_line: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  items: Array<{
    fragrance_brand: string;
    fragrance_name: string;
    size_ml: number;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
};

async function loadOrder(orderId: number): Promise<OrderData | null> {
  const orderRes = await query(
    `SELECT public_id, customer_email, customer_name, total_cents, currency,
            shipping_zone_name, shipping_address_line, shipping_city, shipping_state,
            shipping_postal_code
     FROM "order" WHERE id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) return null;
  const itemsRes = await query(
    `SELECT fragrance_brand, fragrance_name, size_ml, qty, unit_price_cents, line_total_cents
     FROM order_item WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  const orderData = orderRes.rows[0] as Record<string, unknown>;
  return { ...orderData, items: itemsRes.rows } as OrderData;
}

function emailTemplate(opts: { title: string; icon: string; iconColor: string; body: string; footer: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;background:#141414;color:#f5f5f5;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-style:italic;font-size:28px;color:#d4af37;margin:0;">Polianthes</h1>
      <p style="color:#666;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Perfumería de autor</p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:48px;height:48px;border-radius:50%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:22px;">${opts.icon}</span>
      </div>
      <h2 style="font-style:italic;font-size:22px;color:#f5f5f5;margin:0;">${opts.title}</h2>
    </div>
    ${opts.body}
    <div style="text-align:center;color:#666;font-size:11px;padding:16px 0 0;border-top:1px solid #222;margin-top:24px;">
      <p>${opts.footer}</p>
      <p style="margin-top:8px;opacity:0.5;">Polianthes © ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

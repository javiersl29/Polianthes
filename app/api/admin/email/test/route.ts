import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email/test?email=cliente@ejemplo.com
 * Envía un email de prueba y devuelve el error exacto si falla.
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const to = req.nextUrl.searchParams.get("email");
  if (!to) return NextResponse.json({ error: "Falta parámetro email" }, { status: 400 });

  try {
    const { getNotificationConfig } = await import("@/lib/notifications");
    const config = await getNotificationConfig();
    if (!config) {
      return NextResponse.json({ ok: false, message: "No hay configuración. Guarda primero." });
    }
    if (!config.active) {
      return NextResponse.json({ ok: false, message: "Las notificaciones están desactivadas. Actívalas y guarda." });
    }
    if (config.provider === "none") {
      return NextResponse.json({ ok: false, message: "Proveedor en 'none'. Cambia a Resend o SMTP." });
    }

    const html = `
      <div style="font-family:Georgia,serif;background:#0c0c0c;padding:32px;color:#f5f5f5;max-width:560px;margin:0 auto;">
        <h1 style="color:#d4af37;font-style:italic;text-align:center;">Polianthes</h1>
        <h2 style="color:#f5f5f5;text-align:center;">🔔 Email de prueba</h2>
        <p style="color:#999;text-align:center;">Si estás leyendo esto, la configuración funciona correctamente. ✅</p>
        <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:16px 0;font-size:13px;color:#999;">
          <p><strong style="color:#d4af37;">Proveedor:</strong> ${config.provider}</p>
          <p><strong style="color:#d4af37;">Remitente:</strong> ${config.from_name} &lt;${config.from_email}&gt;</p>
          <p><strong style="color:#d4af37;">Destinatario:</strong> ${to}</p>
        </div>
      </div>
    `;
    const text = "Polianthes — Email de prueba. Si estás leyendo esto, funciona correctamente.";

    const from = `${config.from_name} <${config.from_email}>`;

    if (config.provider === "resend" && config.resend_api_key) {
      console.log("[email/test] Enviando vía Resend a:", to, "from:", from);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ from, to: [to], subject: "🔔 Polianthes — Email de prueba", html, text }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        const errText = await r.text();
        console.error("[email/test] Resend error:", r.status, errText);
        let parsed: { message?: string; name?: string } = {};
        try { parsed = JSON.parse(errText); } catch { /* */ }
        const hint = r.status === 403
          ? " → Posibles causas: (1) El remitente no está verificado en Resend. Usa 'onboarding@resend.dev' para pruebas. (2) La API key no tiene permisos. (3) El destinatario debe ser el email de tu cuenta de Resend (plan free)."
          : r.status === 401
          ? " → API key inválida o expirada. Vuelve a copiarla desde resend.com/api-keys"
          : r.status === 422
          ? " → El email del remitente o destinatario tiene formato inválido"
          : "";
        return NextResponse.json({
          ok: false,
          message: `Resend ${r.status}: ${parsed.message ?? errText.slice(0, 200)}${hint}`
        });
      }
      const data = await r.json();
      console.log("[email/test] Resend OK:", data.id);
      return NextResponse.json({ ok: true, message: `Email enviado a ${to} vía Resend (ID: ${data.id})` });
    }

    if (config.provider === "smtp" && config.smtp_host) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: config.smtp_host!,
          port: config.smtp_port,
          secure: config.smtp_secure,
          auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_password ?? "" } : undefined
        });
        await transporter.sendMail({ from, to, subject: "🔔 Polianthes — Email de prueba", html, text });
        return NextResponse.json({ ok: true, message: `Email enviado a ${to} vía SMTP` });
      } catch (e) {
        return NextResponse.json({ ok: false, message: `SMTP error: ${e instanceof Error ? e.message : e}` });
      }
    }

    return NextResponse.json({ ok: false, message: `Provider ${config.provider} no configurado completamente` });
  } catch (e) {
    console.error("[email/test] error:", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Error" });
  }
}

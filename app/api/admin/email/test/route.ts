import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email/test?email=cliente@ejemplo.com
 * Envía un email de prueba a la dirección indicada.
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const to = req.nextUrl.searchParams.get("email");
  if (!to) return NextResponse.json({ error: "Falta parámetro email" }, { status: 400 });

  try {
    const { getEmailConfig } = await import("@/lib/email");
    const config = await getEmailConfig();
    if (!config || !config.active || config.provider === "none") {
      return NextResponse.json({ ok: false, message: "Email no está activo. Configura y activa el proveedor primero." });
    }

    const html = `
      <div style="font-family:Georgia,serif;background:#0c0c0c;padding:24px;color:#f5f5f5;">
        <h1 style="color:#d4af37;font-style:italic;">Polianthes — Email de prueba</h1>
        <p>Si estás leyendo esto, la configuración de email funciona correctamente. ✅</p>
        <p style="color:#999;font-size:12px;">Proveedor: ${config.provider} · Remitente: ${config.from_email}</p>
      </div>
    `;
    const text = "Polianthes — Email de prueba\n\nSi estás leyendo esto, la configuración funciona correctamente.";

    const from = `${config.from_name} <${config.from_email}>`;

    if (config.provider === "resend" && config.resend_api_key) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ from, to: [to], subject: "Polianthes — Email de prueba", html, text }),
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) {
        const err = await r.text();
        return NextResponse.json({ ok: false, message: `Resend error ${r.status}: ${err.slice(0, 200)}` });
      }
      return NextResponse.json({ ok: true, message: `Email enviado a ${to} vía Resend` });
    }

    return NextResponse.json({ ok: false, message: `Provider ${config.provider} no implementado para test` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Error" });
  }
}

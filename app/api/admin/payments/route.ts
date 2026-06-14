import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listPaymentProviders,
  upsertPaymentProvider,
  getPaymentProvider,
  PaymentProvider
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

/** Enmascara una API key para mostrarla en la UI: ****1234 */
function mask(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}…${"•".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
}

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const providers = await listPaymentProviders();
  // No devolver claves completas al frontend; sólo versión enmascarada
  const masked = providers.map((p) => ({
    ...p,
    mp_access_token: mask(p.mp_access_token),
    mp_public_key: p.mp_public_key,
    mp_webhook_secret: mask(p.mp_webhook_secret),
    stripe_secret_key: mask(p.stripe_secret_key),
    stripe_publishable_key: p.stripe_publishable_key,
    stripe_webhook_secret: mask(p.stripe_webhook_secret)
  }));
  return NextResponse.json({ providers: masked });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const provider = String(body.provider) as PaymentProvider;
  if (provider !== "mercadopago" && provider !== "stripe") {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  // Campos de texto. Ahora el frontend envía los campos VACÍOS si el
  // usuario no los modifica, así que sólo escribimos si hay un valor
  // real (longitud > 0). La UI ya no envía versiones enmascaradas.
  const stringFields = [
    "mp_access_token", "mp_public_key", "mp_webhook_secret",
    "stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret",
    "notes"
  ];
  for (const f of stringFields) {
    const v = body[f];
    if (typeof v === "string" && v.trim().length > 0) {
      // Sanity check: Access Token de MP debe empezar con APP_USR- o TEST-
      // Public Key con APP_USR- también. Si trae "…" o "••••", lo
      // rechazamos por si acaso (versión enmascarada).
      if (v.includes("…") || v.startsWith("••••")) {
        // Ignorar: el frontend ya no debería enviar esto, pero por si acaso
        continue;
      }
      patch[f] = v.trim();
      console.log(`[payments] PATCH ${provider}.${f}: actualizando (primeros 20 chars: ${v.trim().slice(0, 20)}…)`);
    }
  }

  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.mode === "test" || body.mode === "live") patch.mode = body.mode;
  if (typeof body.currency === "string" && body.currency.length === 3) patch.currency = body.currency.toUpperCase();
  if (typeof body.installments_min === "number") patch.installments_min = body.installments_min;
  if (typeof body.installments_max === "number") patch.installments_max = body.installments_max;

  console.log(`[payments] PATCH ${provider}: guardando ${Object.keys(patch).length} campos`);
  await upsertPaymentProvider(provider, patch);
  return NextResponse.json({ ok: true });
}

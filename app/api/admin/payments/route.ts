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

  // Campos de texto: si el cliente envía "" o el mismo valor enmascarado,
  // NO actualizar (significa que no se cambió). Sólo escribir si hay un
  // valor real nuevo.
  const stringFields = [
    "mp_access_token", "mp_public_key", "mp_webhook_secret",
    "stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret",
    "notes"
  ];
  for (const f of stringFields) {
    const v = body[f];
    if (typeof v === "string" && v.length > 0 && !v.includes("…") && !v.startsWith("••••")) {
      patch[f] = v;
    }
  }

  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.mode === "test" || body.mode === "live") patch.mode = body.mode;
  if (typeof body.currency === "string" && body.currency.length === 3) patch.currency = body.currency.toUpperCase();
  if (typeof body.installments_min === "number") patch.installments_min = body.installments_min;
  if (typeof body.installments_max === "number") patch.installments_max = body.installments_max;

  await upsertPaymentProvider(provider, patch);
  return NextResponse.json({ ok: true });
}

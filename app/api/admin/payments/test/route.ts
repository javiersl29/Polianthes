import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

type TestResult = {
  ok: boolean;
  provider: "mercadopago" | "stripe";
  message: string;
  details?: Record<string, unknown>;
};

async function testMercadoPago(accessToken: string, mode: "test" | "live"): Promise<TestResult> {
  if (!accessToken) {
    return { ok: false, provider: "mercadopago", message: "Falta el Access Token de MercadoPago" };
  }
  // Validar el token con el endpoint /users/me de MP
  try {
    const baseUrl = "https://api.mercadopago.com";
    const r = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const data = await r.json();
      const email = String(data.email ?? "");
      const tags = Array.isArray(data.tags) ? data.tags : String(data.tags ?? "").split(",");
      const isTestUser = email.includes("@testuser.com") || tags.some((t: string) => String(t).trim() === "test_user");

      // Detectar Access Token de test user y avisar de forma clara.
      // Los tokens de test user NO funcionan para Payment Brick (pago directo
      // vía /v1/payments), sólo para Checkout Pro (preferencias).
      if (isTestUser) {
        return {
          ok: false,
          provider: "mercadopago",
          message: `⚠ Token de TEST USER detectado (cuenta ${email}). Las cuentas @testuser.com NO pueden procesar pagos con Payment Brick. Necesitas credenciales de tu CUENTA REAL (email personal). Lee: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/credentials`,
          details: { user_id: data.id, country: data.site_id, email, test_user: true }
        };
      }
      return {
        ok: true,
        provider: "mercadopago",
        message: `Conexión exitosa: ${email || data.id} (${mode})`,
        details: { user_id: data.id, country: data.site_id, email }
      };
    }
    return {
      ok: false,
      provider: "mercadopago",
      message: `Error HTTP ${r.status}: ${r.statusText}`
    };
  } catch (e) {
    return {
      ok: false,
      provider: "mercadopago",
      message: e instanceof Error ? e.message : "Error de conexión"
    };
  }
}

async function testStripe(secretKey: string): Promise<TestResult> {
  if (!secretKey) {
    return { ok: false, provider: "stripe", message: "Falta la Secret Key de Stripe" };
  }
  if (!secretKey.startsWith("sk_")) {
    return { ok: false, provider: "stripe", message: "La Secret Key debe empezar con 'sk_'" };
  }
  try {
    // Llamar al endpoint /v1/account con la Bearer key. Devuelve info de la cuenta.
    const r = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const data = await r.json();
      return {
        ok: true,
        provider: "stripe",
        message: `Conexión exitosa: ${data.display_name ?? data.email ?? data.id} (${data.country})`,
        details: { account_id: data.id, country: data.country, default_currency: data.default_currency }
      };
    }
    return {
      ok: false,
      provider: "stripe",
      message: `Error HTTP ${r.status}: ${r.statusText}`
    };
  } catch (e) {
    return {
      ok: false,
      provider: "stripe",
      message: e instanceof Error ? e.message : "Error de conexión"
    };
  }
}

/**
 * GET /api/admin/payments/test?provider=mercadopago|stripe
 * Testea que las credenciales guardadas en la DB funcionen.
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const provider = String(req.nextUrl.searchParams.get("provider") ?? "");
  if (provider !== "mercadopago" && provider !== "stripe") {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }
  const config = await getPaymentProvider(provider);
  if (!config) return NextResponse.json({ error: "config no encontrada" }, { status: 404 });

  let result: TestResult;
  if (provider === "mercadopago") {
    result = await testMercadoPago(config.mp_access_token ?? "", config.mode);
  } else {
    result = await testStripe(config.stripe_secret_key ?? "");
  }
  return NextResponse.json(result);
}

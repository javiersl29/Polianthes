import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listShippingZones,
  upsertShippingZone,
  deleteShippingZone
} from "@/lib/admin-data";
import { parseMXN } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const zones = await listShippingZones();
  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }
  const kind = body.kind === "pickup" ? "pickup" : "shipping";

  // Conversión de moneda: el frontend envía strings en MXN con decimales
  // (ej. "99.50"). parseMXN los convierte a centavos (9950).
  const costCents = kind === "pickup"
    ? 0
    : parseMXN(String(body.cost ?? "0")) ?? 0;
  const freeFromCents = body.free_from != null && String(body.free_from).trim() !== ""
    ? parseMXN(String(body.free_from))
    : null;

  // Para pickup, validar que tenga dirección
  if (kind === "pickup" && !body.pickup_address) {
    return NextResponse.json({ error: "La dirección del sitio de entrega es obligatoria" }, { status: 400 });
  }
  // Para shipping, validar CP y costo
  if (kind === "shipping") {
    if (!body.postal_code_prefix) {
      return NextResponse.json({ error: "El prefijo de CP es obligatorio para zonas de envío" }, { status: 400 });
    }
    if (costCents < 0) {
      return NextResponse.json({ error: "El costo no puede ser negativo" }, { status: 400 });
    }
  }

  const id = await upsertShippingZone({
    id: body.id ? Number(body.id) : undefined,
    name: String(body.name),
    kind,
    postal_code_prefix: body.postal_code_prefix ?? "",
    cost_cents: costCents,
    free_from_cents: freeFromCents,
    estimated_days: body.estimated_days ? String(body.estimated_days) : null,
    active: body.active !== false,
    display_order: Number(body.display_order ?? 0),
    pickup_address: body.pickup_address ?? null,
    pickup_city: body.pickup_city ?? null,
    pickup_state: body.pickup_state ?? null,
    pickup_postal_code: body.pickup_postal_code ?? null,
    pickup_schedule: body.pickup_schedule ?? null,
    pickup_lat: body.pickup_lat ? Number(body.pickup_lat) : null,
    pickup_lng: body.pickup_lng ? Number(body.pickup_lng) : null,
    phone: body.phone ?? null,
    email: body.email ?? null
  });
  const zones = await listShippingZones();
  return NextResponse.json({ id, zones });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  await deleteShippingZone(id);
  const zones = await listShippingZones();
  return NextResponse.json({ zones });
}

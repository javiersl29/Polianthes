import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listShippingZones,
  upsertShippingZone,
  deleteShippingZone
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const zones = await listShippingZones();
  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  if (!body.name || !body.postal_code_prefix || body.cost_cents == null) {
    return NextResponse.json({ error: "Faltan campos requeridos (name, postal_code_prefix, cost_cents)" }, { status: 400 });
  }
  const id = await upsertShippingZone({
    id: body.id ? Number(body.id) : undefined,
    name: String(body.name),
    postal_code_prefix: String(body.postal_code_prefix),
    cost_cents: Number(body.cost_cents),
    free_from_cents: body.free_from_cents ? Number(body.free_from_cents) : null,
    estimated_days: body.estimated_days ? String(body.estimated_days) : null,
    active: body.active !== false,
    display_order: Number(body.display_order ?? 0)
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

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getShippingConfig,
  upsertShippingConfig
} from "@/lib/admin-data";
import { invalidateShippingCache, invalidateShippingConfigCache } from "@/lib/shipping";
import { parseMXN } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const config = await getShippingConfig();
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  await upsertShippingConfig({
    default_cost_cents: parseMXN(String(body.default_cost ?? 0)) ?? 0,
    default_free_from_cents:
      body.default_free_from != null && String(body.default_free_from).trim() !== ""
        ? parseMXN(String(body.default_free_from))
        : null,
    default_estimated_days: body.default_estimated_days
      ? String(body.default_estimated_days)
      : null,
    override_enabled: body.override_enabled === true,
    override_cost_cents:
      body.override_cost != null && String(body.override_cost).trim() !== ""
        ? parseMXN(String(body.override_cost))
        : null,
    override_free_from_cents:
      body.override_free_from != null && String(body.override_free_from).trim() !== ""
        ? parseMXN(String(body.override_free_from))
        : null,
    override_estimated_days: body.override_estimated_days
      ? String(body.override_estimated_days)
      : null,
    override_label: body.override_label ? String(body.override_label) : null,
    active: body.active !== false
  });
  invalidateShippingCache();
  invalidateShippingConfigCache();
  const config = await getShippingConfig();
  return NextResponse.json({ ok: true, config });
}

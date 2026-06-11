import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { applyDefaultsToAllFragrances, getPricingDefaults, type PricingDefault } from "@/lib/pricing";
import { parseMXN } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const items = await getPricingDefaults();
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        updates?: Array<{
          size_ml: number;
          price_mxn?: string | number | null;
          cost_mxn?: string | number | null;
          stock?: number | null;
        }>;
        apply_to_all?: boolean;
      }
    | null;
  if (!body || !Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const current = await getPricingDefaults();
  const bySize = new Map<number, PricingDefault>(current.map((d) => [d.size_ml, d]));

  for (const u of body.updates) {
    const cur = bySize.get(u.size_ml);
    if (!cur) continue;
    if (u.price_mxn !== undefined && u.price_mxn !== null) {
      const cents = parseMXN(u.price_mxn);
      if (cents === null) return NextResponse.json({ error: `Precio inválido para ${u.size_ml}ml` }, { status: 400 });
      cur.price_cents = cents;
    }
    if (u.cost_mxn !== undefined && u.cost_mxn !== null) {
      const cents = parseMXN(u.cost_mxn);
      if (cents === null) return NextResponse.json({ error: `Costo inválido para ${u.size_ml}ml` }, { status: 400 });
      cur.cost_cents = cents;
    }
    if (u.stock !== undefined && u.stock !== null) {
      cur.stock = Math.max(-1, Math.round(Number(u.stock)));
    }
  }

  // Persistir cambios
  const { query } = await import("@/lib/db");
  for (const d of bySize.values()) {
    await query(
      `UPDATE pricing_defaults SET price_cents = $1, cost_cents = $2, stock = $3 WHERE size_ml = $4`,
      [d.price_cents, d.cost_cents, d.stock, d.size_ml]
    );
  }

  let applied = 0;
  if (body.apply_to_all) {
    applied = await applyDefaultsToAllFragrances(Array.from(bySize.values()));
  }

  return NextResponse.json({ ok: true, applied });
}

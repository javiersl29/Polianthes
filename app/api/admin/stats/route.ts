import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  topSoldFragrances,
  topSearchedFragrances,
  topRecommendedFragrances,
  getSalesKpis,
  salesTimeseries
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const top = Math.min(50, Number(req.nextUrl.searchParams.get("top") ?? "10"));
  const since = Math.min(365, Number(req.nextUrl.searchParams.get("since_days") ?? "30"));

  const [
    sold,
    searched,
    recommended,
    kpis,
    timeseries
  ] = await Promise.all([
    topSoldFragrances(Number.isFinite(top) ? top : 10),
    topSearchedFragrances(Number.isFinite(top) ? top : 10, Number.isFinite(since) ? since : 30),
    topRecommendedFragrances(Number.isFinite(top) ? top : 10, Number.isFinite(since) ? since : 30),
    getSalesKpis(),
    salesTimeseries(Math.min(90, Number.isFinite(since) ? since : 30))
  ]);

  return NextResponse.json({
    kpis,
    timeseries,
    sold,
    searched,
    recommended,
    since_days: Number.isFinite(since) ? since : 30
  });
}

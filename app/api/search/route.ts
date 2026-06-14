import { NextRequest, NextResponse } from "next/server";
import { searchFragrances, countSearchFragrances, Gender } from "@/lib/fragrances";
import { logSearch } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const note = req.nextUrl.searchParams.get("note") ?? "";
  const gParam = req.nextUrl.searchParams.get("gender");
  const gender: Gender | null =
    gParam === "hombre" || gParam === "mujer" || gParam === "unisex" ? gParam : null;
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? "60"));
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

  const [items, total] = await Promise.all([
    searchFragrances(q, note, gender, limit, offset),
    countSearchFragrances(q, note, gender)
  ]);

  void logSearch({
    query: q,
    note: note || null,
    family: null,
    gender: gender,
    clickedSlug: null,
    resultsCount: total,
    sessionId: null
  });

  return NextResponse.json({ items, total, hasMore: offset + items.length < total });
}

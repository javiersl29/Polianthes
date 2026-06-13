import { NextRequest, NextResponse } from "next/server";
import { searchFragrances, Gender } from "@/lib/fragrances";
import { logSearch } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const note = req.nextUrl.searchParams.get("note") ?? "";
  const gParam = req.nextUrl.searchParams.get("gender");
  const gender: Gender | null =
    gParam === "hombre" || gParam === "mujer" || gParam === "unisex" ? gParam : null;
  const items = await searchFragrances(q, note, gender);
  // Log de búsqueda (no bloquea la respuesta; fire-and-forget)
  void logSearch({
    query: q,
    note: note || null,
    family: null,
    gender: gender,
    clickedSlug: null,
    resultsCount: items.length,
    sessionId: null
  });
  return NextResponse.json({ items });
}

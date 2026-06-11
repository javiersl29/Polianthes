import { NextRequest, NextResponse } from "next/server";
import { searchFragrances, Gender } from "@/lib/fragrances";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const note = req.nextUrl.searchParams.get("note") ?? "";
  const gParam = req.nextUrl.searchParams.get("gender");
  const gender: Gender | null =
    gParam === "hombre" || gParam === "mujer" || gParam === "unisex" ? gParam : null;
  const items = await searchFragrances(q, note, gender);
  return NextResponse.json({ items });
}

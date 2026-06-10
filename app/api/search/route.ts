import { NextRequest, NextResponse } from "next/server";
import { searchFragrances } from "@/lib/fragrances";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const note = req.nextUrl.searchParams.get("note") ?? "";
  const items = await searchFragrances(q, note);
  return NextResponse.json({ items });
}

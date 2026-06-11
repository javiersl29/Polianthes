import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { testImageConnection } from "@/lib/ai-image";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const result = await testImageConnection();
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { path?: string; paths?: string[]; tag?: string } = {};
  try { body = await req.json(); } catch { body = {}; }
  const revalidated: string[] = [];
  if (body.path) {
    revalidatePath(body.path);
    revalidated.push(body.path);
  }
  if (body.paths) {
    for (const p of body.paths) {
      revalidatePath(p);
      revalidated.push(p);
    }
  }
  if (body.tag) {
    revalidateTag(body.tag);
    revalidated.push(`tag:${body.tag}`);
  }
  if (revalidated.length === 0) {
    revalidatePath("/");
    revalidated.push("/");
  }
  return NextResponse.json({ ok: true, revalidated });
}

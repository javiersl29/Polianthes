import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const FLAGS_FILE = "/tmp/polianthes-artistic-names.flag";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const total = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM fragrance WHERE active = TRUE`);
  const withName = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM fragrance WHERE active = TRUE AND artistic_name IS NOT NULL`);
  const running = require("node:fs").existsSync(FLAGS_FILE);
  return NextResponse.json({
    total: Number(total.rows[0]?.count ?? 0),
    with_name: Number(withName.rows[0]?.count ?? 0),
    running
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { only_missing?: boolean };
  const onlyMissing = body.only_missing !== false;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ONLY_MISSING: onlyMissing ? "1" : "0"
  };
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "scripts", "generate-artistic-names.ts");
  const tsxBin = path.join(cwd, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

  try {
    require("node:fs").writeFileSync(FLAGS_FILE, String(Date.now()));
  } catch {}

  const child = spawn(tsxBin, [scriptPath], {
    cwd,
    env,
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  return NextResponse.json({ ok: true, started: true, only_missing: onlyMissing });
}

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, slug, brand, name, full_name, family, image_url, display_code, artistic_name, inspired_by_name, inspired_by_brand
     FROM fragrance WHERE active = TRUE ORDER BY brand, name`
  );
  return NextResponse.json({ items: result.rows });
}

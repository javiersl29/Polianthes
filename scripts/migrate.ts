import fs from "node:fs";
import { getPool } from "../lib/db";

async function run() {
  const sql = fs.readFileSync("db/schema.sql", "utf8");
  const pool = getPool();
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log("[migrate] schema aplicado");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

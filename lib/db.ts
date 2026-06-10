import { Pool } from "pg";

declare global {
  var __pool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pool) {
    global.__pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global.__pool;
}

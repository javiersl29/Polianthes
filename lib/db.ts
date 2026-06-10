import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada");
  }
  if (!global.__pgPool) {
    global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global.__pgPool;
}

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const pool = getPool();
  return pool.query(text, params) as Promise<{ rows: T[] }>;
}

import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";

const SESSION_COOKIE = "polianthes_admin";
const SESSION_TTL_HOURS = 12;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "polianthes-dev-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

export async function ensureDefaultAdmin(): Promise<void> {
  const user = process.env.ADMIN_USERNAME ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "polianthes";
  const stored = hashPassword(pass);
  await query(
    `INSERT INTO admin_user (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [user, stored]
  );
}

export async function login(username: string, password: string): Promise<boolean> {
  const result = await query<{ id: number; password_hash: string }>(
    `SELECT id, password_hash FROM admin_user WHERE username = $1`,
    [username]
  );
  if (result.rows.length === 0) return false;
  if (!verifyPassword(password, result.rows[0].password_hash)) return false;
  const expires = Date.now() + SESSION_TTL_HOURS * 3600 * 1000;
  const payload = `${result.rows[0].id}:${expires}`;
  const signature = sign(payload);
  cookies().set(SESSION_COOKIE, `${payload}:${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600
  });
  return true;
}

export function logout(): void {
  cookies().delete(SESSION_COOKIE);
}

export function isAuthenticated(): boolean {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  const [id, expires, signature] = cookie.split(":");
  if (!id || !expires || !signature) return false;
  if (Date.now() > Number(expires)) return false;
  return sign(`${id}:${expires}`) === signature;
}

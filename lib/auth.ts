import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { verifyTotpToken } from "./totp";

const SESSION_COOKIE = "polianthes_admin";
const SESSION_TTL_HOURS = 12;

/**
 * Cookie temporal que guarda el ID del usuario que ya pasó el paso 1
 * (username + password) pero falta verificar TOTP. Expira en 5 min.
 */
const PENDING_2FA_COOKIE = "polianthes_2fa_pending";
const PENDING_2FA_TTL_SECONDS = 300;

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

/**
 * Paso 1 del login: verifica username + password.
 * Si el usuario tiene TOTP habilitado, NO establece la sesión completa
 * sino que devuelve "needs_2fa" y guarda una cookie temporal pendiente.
 * Si NO tiene TOTP, establece la sesión completa directamente.
 *
 * @returns "ok" si login completo, "needs_2fa" si falta TOTP, "fail" si credenciales inválidas
 */
export async function login(username: string, password: string): Promise<"ok" | "needs_2fa" | "fail"> {
  const result = await query<{ id: number; password_hash: string; totp_enabled: boolean; totp_secret: string | null }>(
    `SELECT id, password_hash, totp_enabled, totp_secret FROM admin_user WHERE username = $1`,
    [username]
  );
  if (result.rows.length === 0) return "fail";
  const user = result.rows[0];
  if (!verifyPassword(password, user.password_hash)) return "fail";

  // Si TOTP está habilitado, guardar cookie pendiente (no iniciar sesión)
  if (user.totp_enabled && user.totp_secret) {
    const expires = Date.now() + PENDING_2FA_TTL_SECONDS * 1000;
    const payload = `${user.id}:${expires}`;
    const signature = sign(payload);
    cookies().set(PENDING_2FA_COOKIE, `${payload}:${signature}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_2FA_TTL_SECONDS
    });
    return "needs_2fa";
  }

  // Sin TOTP → sesión completa
  setSessionCookie(user.id);
  return "ok";
}

/**
 * Paso 2 del login: verifica el código TOTP y establece la sesión completa.
 * Requiere que el paso 1 ya haya pasado (cookie pendiente válida).
 */
export async function verify2Fa(code: string): Promise<boolean> {
  const pendingId = getPending2FaUserId();
  if (pendingId === null) return false;

  const result = await query<{ id: number; totp_secret: string }>(
    `SELECT id, totp_secret FROM admin_user WHERE id = $1 AND totp_enabled = TRUE`,
    [pendingId]
  );
  if (result.rows.length === 0) return false;

  const user = result.rows[0];
  if (!user.totp_secret) return false;
  if (!verifyTotpToken(code, user.totp_secret)) return false;

  // TOTP correcto → establecer sesión y limpiar pendiente
  setSessionCookie(user.id);
  cookies().delete(PENDING_2FA_COOKIE);
  return true;
}

/**
 * Verifica si hay una cookie pendiente de 2FA válida.
 * Devuelve el ID del usuario pendiente, o null si no hay.
 */
export function getPending2FaUserId(): number | null {
  const cookie = cookies().get(PENDING_2FA_COOKIE)?.value;
  if (!cookie) return null;
  const [id, expires, signature] = cookie.split(":");
  if (!id || !expires || !signature) return null;
  if (Date.now() > Number(expires)) return null;
  if (sign(`${id}:${expires}`) !== signature) return null;
  return Number(id);
}

function setSessionCookie(userId: number): void {
  const expires = Date.now() + SESSION_TTL_HOURS * 3600 * 1000;
  const payload = `${userId}:${expires}`;
  const signature = sign(payload);
  cookies().set(SESSION_COOKIE, `${payload}:${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600
  });
}

export function logout(): void {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(PENDING_2FA_COOKIE);
}

export function isAuthenticated(): boolean {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  const [id, expires, signature] = cookie.split(":");
  if (!id || !expires || !signature) return false;
  if (Date.now() > Number(expires)) return false;
  return sign(`${id}:${expires}`) === signature;
}

import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";

const CUSTOMER_COOKIE = "polianthes_customer";
const CUSTOMER_TTL_DAYS = 30;
const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

function getCustomerSecret(): string {
  return process.env.CUSTOMER_SESSION_SECRET ?? "polianthes-customer-dev-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getCustomerSecret()).update(value).digest("hex");
}

// ──────────────────────────────────────────────────────────────
// Hashing de contraseñas (mismo patrón que lib/auth.ts)
// ──────────────────────────────────────────────────────────────

export function hashCustomerPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyCustomerPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export type Customer = {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  phone: string | null;
  birth_date: string | null;
  default_address_line: string | null;
  default_address_line2: string | null;
  default_city: string | null;
  default_state: string | null;
  default_postal_code: string | null;
  default_country: string | null;
  affiliated: boolean;
  total_orders: number;
  total_spent_cents: number;
  email_verified: boolean;
  has_password: boolean;
  google_id: string | null;
  created_at: string;
  last_login_at: string | null;
};

const CUSTOMER_SELECT = `id, email, name, picture_url, phone, birth_date,
            default_address_line, default_address_line2, default_city, default_state,
            default_postal_code, default_country, affiliated, total_orders, total_spent_cents,
            email_verified, (password_hash IS NOT NULL) AS has_password, google_id,
            created_at, last_login_at`;

export function setCustomerCookie(customerId: number): void {
  const expires = Date.now() + CUSTOMER_TTL_DAYS * 24 * 3600 * 1000;
  const payload = `${customerId}:${expires}`;
  const signature = sign(payload);
  cookies().set(CUSTOMER_COOKIE, `${payload}:${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_TTL_DAYS * 24 * 3600
  });
}

export function clearCustomerCookie(): void {
  cookies().delete(CUSTOMER_COOKIE);
}

export function getCustomerIdFromCookie(): number | null {
  const cookie = cookies().get(CUSTOMER_COOKIE)?.value;
  if (!cookie) return null;
  const [id, expires, signature] = cookie.split(":");
  if (!id || !expires || !signature) return null;
  if (Date.now() > Number(expires)) return null;
  if (sign(`${id}:${expires}`) !== signature) return null;
  return Number(id);
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const id = getCustomerIdFromCookie();
  if (!id) return null;
  const r = await query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customer WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const r = await query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customer WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return r.rows[0] ?? null;
}

export async function findCustomerByGoogleId(googleId: string): Promise<Customer | null> {
  const r = await query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customer WHERE google_id = $1`,
    [googleId]
  );
  return r.rows[0] ?? null;
}

export async function createOrUpdateCustomerFromGoogle(opts: {
  googleId: string;
  email: string;
  name: string;
  pictureUrl: string | null;
}): Promise<Customer> {
  const email = opts.email.toLowerCase().trim();
  const r = await query<Customer>(
    `INSERT INTO customer (email, google_id, name, picture_url, email_verified, last_login_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
       google_id = EXCLUDED.google_id,
       name = EXCLUDED.name,
       picture_url = EXCLUDED.picture_url,
       email_verified = TRUE,
       last_login_at = NOW(),
       updated_at = NOW()
     RETURNING ${CUSTOMER_SELECT}`,
    [email, opts.googleId, opts.name, opts.pictureUrl]
  );
  return r.rows[0];
}

export async function updateCustomerProfile(
  customerId: number,
  patch: {
    name?: string;
    phone?: string | null;
    birth_date?: string | null;
    default_address_line?: string | null;
    default_address_line2?: string | null;
    default_city?: string | null;
    default_state?: string | null;
    default_postal_code?: string | null;
    default_country?: string | null;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i}`);
    values.push(value);
    i++;
  }
  if (fields.length === 0) return;
  fields.push(`updated_at = NOW()`);
  values.push(customerId);
  await query(`UPDATE customer SET ${fields.join(", ")} WHERE id = $${i}`, values);
}

export async function markCustomerAffiliated(customerId: number): Promise<void> {
  await query(
    `UPDATE customer SET affiliated = TRUE, updated_at = NOW() WHERE id = $1`,
    [customerId]
  );
}

export async function incrementCustomerStats(
  customerId: number,
  totalCents: number
): Promise<void> {
  await query(
    `UPDATE customer
     SET total_orders = total_orders + 1,
         total_spent_cents = total_spent_cents + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [totalCents, customerId]
  );
}

// ──────────────────────────────────────────────────────────────
// Registro / Login con email + password
// ──────────────────────────────────────────────────────────────

/**
 * Crea un cliente con email/password. Falla si el email ya existe.
 * NO marca email_verified=TRUE: el cliente debe confirmar vía email.
 */
export async function createCustomerFromEmail(opts: {
  email: string;
  password: string;
  name: string;
}): Promise<{ customer: Customer; token: string; expiresAt: Date }> {
  const email = opts.email.toLowerCase().trim();
  const existing = await findCustomerByEmail(email);
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }
  const passwordHash = hashCustomerPassword(opts.password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3600_000);
  const r = await query<Customer>(
    `INSERT INTO customer (email, name, password_hash, email_verified, verification_token, verification_expires_at, last_login_at, updated_at)
     VALUES ($1, $2, $3, FALSE, $4, $5, NOW(), NOW())
     RETURNING ${CUSTOMER_SELECT}`,
    [email, opts.name, passwordHash, token, expiresAt]
  );
  return { customer: r.rows[0], token, expiresAt };
}

/**
 * Login con email/password. Devuelve el customer si las credenciales son válidas.
 * Lanza error si el customer no tiene password_hash (es solo de Google).
 */
export async function loginCustomerWithPassword(email: string, password: string): Promise<Customer> {
  const customer = await findCustomerByEmail(email);
  if (!customer) throw new Error("INVALID_CREDENTIALS");
  // Cargar password_hash desde DB (no viene en Customer type por seguridad)
  const r = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM customer WHERE id = $1`,
    [customer.id]
  );
  const storedHash = r.rows[0]?.password_hash;
  if (!storedHash) {
    // El cliente existe pero solo tiene Google — no puede usar password login
    throw new Error("GOOGLE_ONLY_ACCOUNT");
  }
  if (!verifyCustomerPassword(password, storedHash)) {
    throw new Error("INVALID_CREDENTIALS");
  }
  // Actualizar last_login_at
  await query(`UPDATE customer SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [customer.id]);
  return customer;
}

/**
 * Verifica un token de confirmación de email.
 * Devuelve el customer si el token es válido y no ha expirado.
 */
export async function verifyCustomerEmail(token: string): Promise<Customer | null> {
  const r = await query<{ id: number }>(
    `SELECT id FROM customer
     WHERE verification_token = $1
       AND verification_expires_at > NOW()`,
    [token]
  );
  if (!r.rows[0]) return null;
  const customerId = r.rows[0].id;
  await query(
    `UPDATE customer
     SET email_verified = TRUE,
         verification_token = NULL,
         verification_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [customerId]
  );
  const updated = await query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customer WHERE id = $1`,
    [customerId]
  );
  return updated.rows[0] ?? null;
}

/**
 * Reenvía el email de confirmación si el customer no está verificado.
 */
export async function resendVerification(customerId: number): Promise<{ token: string; expiresAt: Date } | null> {
  const r = await query<{ email_verified: boolean }>(
    `SELECT email_verified FROM customer WHERE id = $1`,
    [customerId]
  );
  if (!r.rows[0]) return null;
  if (r.rows[0].email_verified) return null;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3600_000);
  await query(
    `UPDATE customer SET verification_token = $1, verification_expires_at = $2, updated_at = NOW() WHERE id = $3`,
    [token, expiresAt, customerId]
  );
  return { token, expiresAt };
}

/**
 * Inicia el flujo de recuperación de contraseña.
 * Genera un token que expira en 1 hora.
 */
export async function initiatePasswordReset(email: string): Promise<{ customerId: number; name: string; token: string; expiresAt: Date } | null> {
  const customer = await findCustomerByEmail(email);
  if (!customer) return null;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600_000);
  await query(
    `UPDATE customer SET password_reset_token = $1, password_reset_expires_at = $2, updated_at = NOW() WHERE id = $3`,
    [token, expiresAt, customer.id]
  );
  return { customerId: customer.id, name: customer.name, token, expiresAt };
}

/**
 * Reset password con token. Devuelve true si tuvo éxito.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const r = await query<{ id: number }>(
    `SELECT id FROM customer WHERE password_reset_token = $1 AND password_reset_expires_at > NOW()`,
    [token]
  );
  if (!r.rows[0]) return false;
  const passwordHash = hashCustomerPassword(newPassword);
  await query(
    `UPDATE customer
     SET password_hash = $1,
         password_reset_token = NULL,
         password_reset_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, r.rows[0].id]
  );
  return true;
}

/**
 * Cambia el password de un customer autenticado.
 */
export async function changeCustomerPassword(customerId: number, currentPassword: string, newPassword: string): Promise<boolean> {
  const r = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM customer WHERE id = $1`,
    [customerId]
  );
  const storedHash = r.rows[0]?.password_hash;
  if (!storedHash) return false;
  if (!verifyCustomerPassword(currentPassword, storedHash)) return false;
  const newHash = hashCustomerPassword(newPassword);
  await query(`UPDATE customer SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, customerId]);
  return true;
}

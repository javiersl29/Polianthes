import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { query } from "./db";

const CUSTOMER_COOKIE = "polianthes_customer";
const CUSTOMER_TTL_DAYS = 30;

function getCustomerSecret(): string {
  return process.env.CUSTOMER_SESSION_SECRET ?? "polianthes-customer-dev-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getCustomerSecret()).update(value).digest("hex");
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
  created_at: string;
  last_login_at: string | null;
};

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
    `SELECT id, email, name, picture_url, phone, birth_date,
            default_address_line, default_address_line2, default_city, default_state,
            default_postal_code, default_country, affiliated, total_orders, total_spent_cents,
            created_at, last_login_at
     FROM customer WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const r = await query<Customer>(
    `SELECT id, email, name, picture_url, phone, birth_date,
            default_address_line, default_address_line2, default_city, default_state,
            default_postal_code, default_country, affiliated, total_orders, total_spent_cents,
            created_at, last_login_at
     FROM customer WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return r.rows[0] ?? null;
}

export async function findCustomerByGoogleId(googleId: string): Promise<Customer | null> {
  const r = await query<Customer>(
    `SELECT id, email, name, picture_url, phone, birth_date,
            default_address_line, default_address_line2, default_city, default_state,
            default_postal_code, default_country, affiliated, total_orders, total_spent_cents,
            created_at, last_login_at
     FROM customer WHERE google_id = $1`,
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
    `INSERT INTO customer (email, google_id, name, picture_url, last_login_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
       google_id = EXCLUDED.google_id,
       name = EXCLUDED.name,
       picture_url = EXCLUDED.picture_url,
       last_login_at = NOW(),
       updated_at = NOW()
     RETURNING id, email, name, picture_url, phone, birth_date,
               default_address_line, default_address_line2, default_city, default_state,
               default_postal_code, default_country, affiliated, total_orders, total_spent_cents,
               created_at, last_login_at`,
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

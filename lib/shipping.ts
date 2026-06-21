import { query } from "@/lib/db";
import type { ShippingConfig } from "@/lib/admin-data";
import {
  calculateShipping as calculateShippingPure,
  type ShippingResult,
  type ShippingZone,
  type CalculateShippingInput
} from "@/lib/shipping-client";

// Re-exportar tipos para compatibilidad con el código existente que importa de lib/shipping
export type { ShippingResult, ShippingZone, CalculateShippingInput };

/**
 * Cachés en memoria (60s TTL) para evitar queries repetidas a la DB.
 */
let zonesCache: { at: number; data: ShippingZone[] } | null = null;
async function loadActiveZones(): Promise<ShippingZone[]> {
  if (zonesCache && Date.now() - zonesCache.at < 60_000) return zonesCache.data;
  const r = await query<ShippingZone>(
    `SELECT * FROM shipping_zone WHERE active = TRUE ORDER BY kind, display_order, name`
  );
  zonesCache = { at: Date.now(), data: r.rows };
  return r.rows;
}

export function invalidateShippingCache(): void {
  zonesCache = null;
}

let configCache: { at: number; data: ShippingConfig | null } | null = null;
async function loadConfig(): Promise<ShippingConfig | null> {
  if (configCache && Date.now() - configCache.at < 60_000 && configCache.data) return configCache.data;
  const r = await query<ShippingConfig>(`SELECT * FROM shipping_config WHERE id = 1`);
  if (!r.rows[0]) return null;
  configCache = { at: Date.now(), data: r.rows[0] };
  return r.rows[0];
}

export function invalidateShippingConfigCache(): void {
  configCache = null;
}

/**
 * Versión ASYNC (server): carga zonas + config desde DB con caché 60s.
 * Usa la misma lógica pura de lib/shipping-client.ts.
 */
export async function calculateShipping(input: Omit<CalculateShippingInput, "zones" | "config">): Promise<ShippingResult> {
  const [zones, config] = await Promise.all([loadActiveZones(), loadConfig()]);
  return calculateShippingPure({ ...input, zones, config });
}

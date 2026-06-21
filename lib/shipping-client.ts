/**
 * Versión cliente de calculateShipping (sin imports de DB).
 * Replica la lógica de lib/shipping.ts pero usando datos ya cargados.
 * Esto evita cargar pg/Node en el bundle del navegador.
 */

export type ShippingZone = {
  id: number;
  name: string;
  kind: "shipping" | "pickup";
  postal_code_prefix: string;
  cost_cents: number;
  free_from_cents: number | null;
  estimated_days: string | null;
  active: boolean;
  display_order: number;
  pickup_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_schedule: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type ShippingConfig = {
  id: 1;
  default_cost_cents: number;
  default_free_from_cents: number | null;
  default_estimated_days: string | null;
  override_enabled: boolean;
  override_cost_cents: number | null;
  override_free_from_cents: number | null;
  override_estimated_days: string | null;
  override_label: string | null;
  active: boolean;
  updated_at: string;
};

export type ShippingResult = {
  shipping_cents: number;
  zone_id: number | null;
  zone_name: string;
  estimated_days: string | null;
  is_pickup: boolean;
  is_free: boolean;
  free_reason: "zone" | "default" | "override" | "promo" | "pickup" | null;
  source: "zone" | "default" | "override" | "pickup";
  address: {
    line: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  };
};

type ShippingAddress = {
  address_line?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

export type CalculateShippingInput = {
  deliveryMode: "shipping" | "pickup";
  postalCode?: string | null;
  subtotalPreCents: number;
  subtotalPostCents: number;
  shippingAddress?: ShippingAddress;
  hasFreeShippingPromo?: boolean;
  explicitZoneId?: number | null;
  zones: ShippingZone[];
  config: ShippingConfig | null;
};

function findZoneByPrefix(zones: ShippingZone[], prefix: string): ShippingZone | null {
  if (!prefix) return null;
  const matches = zones
    .filter((z) => z.kind === "shipping" && z.active && prefix.startsWith(z.postal_code_prefix))
    .sort((a, b) => b.postal_code_prefix.length - a.postal_code_prefix.length || b.display_order - a.display_order);
  return matches[0] ?? null;
}

export function calculateShipping(input: CalculateShippingInput): ShippingResult {
  const { deliveryMode, postalCode, subtotalPreCents, shippingAddress, explicitZoneId, zones, config } = input;
  const hasFreeShippingPromo = !!input.hasFreeShippingPromo;

  if (deliveryMode === "pickup") {
    const pickup = explicitZoneId
      ? zones.find((z) => z.id === explicitZoneId && z.kind === "pickup" && z.active)
      : null;
    if (pickup) {
      return {
        shipping_cents: 0,
        zone_id: pickup.id,
        zone_name: pickup.name,
        estimated_days: pickup.estimated_days,
        is_pickup: true,
        is_free: true,
        free_reason: "pickup",
        source: "pickup",
        address: {
          line: pickup.pickup_address,
          line2: null,
          city: pickup.pickup_city,
          state: pickup.pickup_state,
          postal_code: pickup.pickup_postal_code
        }
      };
    }
    return {
      shipping_cents: 0,
      zone_id: null,
      zone_name: "Recogida en sitio",
      estimated_days: null,
      is_pickup: true,
      is_free: true,
      free_reason: "pickup",
      source: "pickup",
      address: { line: null, line2: null, city: null, state: null, postal_code: null }
    };
  }

  // Override
  if (config?.active && config.override_enabled) {
    const oCost = config.override_cost_cents ?? 0;
    const oFreeFrom = config.override_free_from_cents ?? null;
    const oLabel = config.override_label || "Envío estándar";
    const oDays = config.override_estimated_days;
    const fromFreeFrom = oFreeFrom != null && subtotalPreCents >= oFreeFrom;
    const oFree = fromFreeFrom || hasFreeShippingPromo;
    return {
      shipping_cents: oFree ? 0 : oCost,
      zone_id: null,
      zone_name: oLabel,
      estimated_days: oDays,
      is_pickup: false,
      is_free: oFree,
      free_reason: oFree ? (hasFreeShippingPromo && !fromFreeFrom ? "promo" : "override") : null,
      source: "override",
      address: {
        line: shippingAddress?.address_line ?? null,
        line2: shippingAddress?.address_line2 ?? null,
        city: shippingAddress?.city ?? null,
        state: shippingAddress?.state ?? null,
        postal_code: shippingAddress?.postal_code ?? postalCode ?? null
      }
    };
  }

  // Zona
  const zone = explicitZoneId
    ? zones.find((z) => z.id === explicitZoneId && z.kind === "shipping" && z.active) ?? null
    : findZoneByPrefix(zones, postalCode ?? "");

  if (zone) {
    const zFreeFrom = zone.free_from_cents ?? null;
    const fromFreeFrom = zFreeFrom != null && subtotalPreCents >= zFreeFrom;
    const zFree = fromFreeFrom || hasFreeShippingPromo;
    return {
      shipping_cents: zFree ? 0 : zone.cost_cents,
      zone_id: zone.id,
      zone_name: zone.name,
      estimated_days: zone.estimated_days,
      is_pickup: false,
      is_free: zFree,
      free_reason: zFree ? (hasFreeShippingPromo && !fromFreeFrom ? "promo" : "zone") : null,
      source: "zone",
      address: {
        line: shippingAddress?.address_line ?? null,
        line2: shippingAddress?.address_line2 ?? null,
        city: shippingAddress?.city ?? null,
        state: shippingAddress?.state ?? null,
        postal_code: shippingAddress?.postal_code ?? postalCode ?? null
      }
    };
  }

  // Default
  if (config?.active) {
    const dCost = config.default_cost_cents;
    const dFreeFrom = config.default_free_from_cents ?? null;
    const dDays = config.default_estimated_days;
    const fromFreeFrom = dFreeFrom != null && subtotalPreCents >= dFreeFrom;
    const dFree = fromFreeFrom || hasFreeShippingPromo;
    return {
      shipping_cents: dFree ? 0 : dCost,
      zone_id: null,
      zone_name: "Envío estándar",
      estimated_days: dDays,
      is_pickup: false,
      is_free: dFree,
      free_reason: dFree ? (hasFreeShippingPromo && !fromFreeFrom ? "promo" : "default") : null,
      source: "default",
      address: {
        line: shippingAddress?.address_line ?? null,
        line2: shippingAddress?.address_line2 ?? null,
        city: shippingAddress?.city ?? null,
        state: shippingAddress?.state ?? null,
        postal_code: shippingAddress?.postal_code ?? postalCode ?? null
      }
    };
  }

  return {
    shipping_cents: 0,
    zone_id: null,
    zone_name: "Envío",
    estimated_days: null,
    is_pickup: false,
    is_free: true,
    free_reason: null,
    source: "default",
    address: {
      line: shippingAddress?.address_line ?? null,
      line2: shippingAddress?.address_line2 ?? null,
      city: shippingAddress?.city ?? null,
      state: shippingAddress?.state ?? null,
      postal_code: shippingAddress?.postal_code ?? postalCode ?? null
    }
  };
}

// Alias para compatibilidad con el código que ya usaba calculateShippingSync
export const calculateShippingSync = calculateShipping;

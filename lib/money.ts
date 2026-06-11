export const CURRENCY = "MXN";

export type Cents = number;

export function formatMXN(cents: Cents | null | undefined, options?: { withSymbol?: boolean }): string {
  if (cents === null || cents === undefined) return "Consultar";
  const value = cents / 100;
  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return options?.withSymbol === false ? formatted : `$${formatted}`;
}

export function parseMXN(input: string | number): Cents | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (cleaned.trim() === "") return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function minPriceOf(prices: Array<Cents | null | undefined>): Cents | null {
  const valid = prices.filter((p): p is Cents => typeof p === "number" && p > 0);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

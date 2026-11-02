// Money is stored as integer minor units (cents, cents of a rupee) in the
// invoice's own currency. These helpers turn it into text and back.

export type CurrencyInfo = {
  code: string;
  symbol: string;
  decimal_places: number;
};

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 25000000 in LKR (2 places) -> "Rs 250,000.00". */
export function formatMoney(minor: number, currency: CurrencyInfo): string {
  const places = currency.decimal_places;
  const scale = 10 ** places;
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = grouping.format(Math.trunc(abs / scale));
  const fraction = places > 0 ? "." + String(abs % scale).padStart(places, "0") : "";
  return `${sign}${currency.symbol} ${whole}${fraction}`;
}

/**
 * Reads an amount someone typed ("1,234.5") into minor units for a currency
 * with `places` decimal places. Returns null for anything that is not a
 * non-negative amount with at most that many decimals.
 */
export function parseAmount(input: string, places: number): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;

  const [, whole, fraction = ""] = match;
  if (fraction.length > places) return null;

  const minor = Number(whole) * 10 ** places + Number(fraction.padEnd(places, "0") || 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

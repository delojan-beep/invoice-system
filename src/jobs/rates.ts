import "server-only";
import { createAdminClient } from "@/src/supabase/admin";
import { getSettings } from "./data";

// Daily exchange rates into the base currency (CAD), stored per day so each
// invoice keeps the rate of its submission date. The provider is still to be
// chosen; it is picked with FX_PROVIDER and nothing is fetched until it is set.

export type DailyRates = { date: string; source: string; toBase: Record<string, number> };

type Provider = (base: string, currencies: string[]) => Promise<DailyRates>;

/** ExchangeRate-API's open endpoint (no key; covers LKR and CAD). */
export function parseOpenErApi(body: unknown, base: string, currencies: string[]): DailyRates {
  const b = body as { result?: string; base_code?: string; time_last_update_unix?: number; rates?: Record<string, number> };
  if (b.result !== "success" || b.base_code !== base || !b.rates || !b.time_last_update_unix) {
    throw new Error("Unexpected response from open.er-api.com");
  }
  const toBase: Record<string, number> = {};
  for (const code of currencies) {
    const perBase = b.rates[code]; // 1 base = perBase code
    if (typeof perBase === "number" && perBase > 0) toBase[code] = 1 / perBase;
  }
  return {
    date: new Date(b.time_last_update_unix * 1000).toISOString().slice(0, 10),
    source: "open.er-api.com",
    toBase,
  };
}

const PROVIDERS: Record<string, Provider> = {
  "open-er-api": async (base, currencies) => {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`open.er-api.com returned ${res.status}`);
    return parseOpenErApi(await res.json(), base, currencies);
  },
};

/** Fetches today's rates once a day (UTC). */
export async function fetchRates(now: Date): Promise<string> {
  const name = process.env.FX_PROVIDER;
  if (!name) return "skipped: no exchange-rate provider chosen (set FX_PROVIDER)";
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown FX_PROVIDER "${name}". Known: ${Object.keys(PROVIDERS).join(", ")}`);

  const supabase = createAdminClient();
  const base = String((await getSettings()).base_currency ?? "CAD");
  const today = now.toISOString().slice(0, 10);

  const { data: currencies, error } = await supabase.from("currencies").select("code").eq("active", true).neq("code", base);
  if (error) throw error;
  if (!currencies.length) return "no other currencies";

  const { count } = await supabase
    .from("exchange_rates")
    .select("id", { count: "exact", head: true })
    .eq("to_currency", base)
    .gte("created_at", `${today}T00:00:00Z`);
  if (count) return "already fetched today";

  const rates = await provider(base, currencies.map((c) => c.code));
  const rows = Object.entries(rates.toBase).map(([code, rate]) => ({
    rate_date: rates.date,
    from_currency: code,
    to_currency: base,
    rate,
    source: rates.source,
  }));
  const { error: insertError } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "rate_date,from_currency,to_currency", ignoreDuplicates: true });
  if (insertError) throw insertError;

  const missing = currencies.map((c) => c.code).filter((c) => !(c in rates.toBase));
  return `${rows.length} rates for ${rates.date}${missing.length ? `; provider has no rate for ${missing.join(", ")}` : ""}`;
}

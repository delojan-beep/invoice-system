import "server-only";
import { nextEmployeeCode } from "@/src/domain/employee-code";
import { isUuid } from "@/src/domain/ids";
import { createClient } from "@/src/supabase/server";

// Reads for the admin pages. Row-level security lets only admins (with
// two-factor) change these; staff can read them.

// Can't be deleted: monthly drafts find their pre-filled fee line by this name.
export const FEES_LINE_TYPE = "Professional fees";

export async function listUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, employee_code, status, timezone, default_currency, roles:user_roles(role)")
    .order("status")
    .order("name");
  if (error) throw error;
  return data.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) }));
}

export async function getNextEmployeeCode() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("employee_code").not("employee_code", "is", null);
  if (error) throw error;
  return nextEmployeeCode(data.map((p) => p.employee_code));
}

export async function getUser(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, roles:user_roles(role)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, roles: data.roles.map((r) => r.role) } : null;
}

export async function getReferenceLists() {
  const supabase = await createClient();
  const [currencies, taxRates, lineTypes] = await Promise.all([
    supabase.from("currencies").select("*").order("code"),
    supabase.from("tax_rates").select("*").order("currency_code").order("percentage"),
    supabase.from("line_types").select("*").order("sort_order"),
  ]);
  for (const r of [currencies, taxRates, lineTypes]) if (r.error) throw r.error;
  return { currencies: currencies.data!, taxRates: taxRates.data!, lineTypes: lineTypes.data! };
}

export async function getAllSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("key, value, updated_at");
  if (error) throw error;
  return Object.fromEntries(data.map((s) => [s.key, s.value])) as Record<string, unknown>;
}

/** IANA timezones for pickers, with the ones QNetwork uses first. */
export function timezones() {
  const common = ["Asia/Colombo", "America/Toronto", "America/Vancouver"];
  return [...common, ...Intl.supportedValuesOf("timeZone").filter((z) => !common.includes(z))];
}

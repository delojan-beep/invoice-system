import type { InvoiceFilters } from "@/src/domain/staff-queries";

const STATUSES = ["submitted", "approved", "rejected", "paid", "overdue", "unconfirmed"] as const;

/** Reads the dashboard filters from the URL; anything unexpected is ignored. */
export function parseFilters(params: Record<string, string | string[] | undefined>): InvoiceFilters {
  const one = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const status = one("status");
  const month = one("month");
  const employee = one("employee");
  const currency = one("currency");
  return {
    employee: employee && /^[0-9a-f-]{36}$/i.test(employee) ? employee : undefined,
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    status: STATUSES.find((s) => s === status),
  };
}

export function filtersToQuery(filters: InvoiceFilters) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  return q.toString();
}

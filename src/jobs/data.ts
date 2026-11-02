import "server-only";
import type { InvoiceRow } from "@/src/email/templates";
import { formatDate, formatMonth } from "@/src/domain/format";
import { STATUS_LABELS, isOverdue, type InvoiceStatus } from "@/src/domain/invoice";
import { formatMoney } from "@/src/domain/money";
import { createAdminClient } from "@/src/supabase/admin";

// Shared reads for scheduled jobs. Jobs run with the secret key (no user),
// so they see everything; nothing here is reachable from a browser.

export type Person = { id: string; name: string; email: string; timezone: string };
export type AppRole = "employee" | "approver" | "accounts" | "admin";

export function appUrl(path: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export async function getSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries(data.map((s) => [s.key, s.value])) as Record<string, unknown>;
}

/** Active people holding any of these roles. */
export async function peopleWithRoles(roles: AppRole[]): Promise<Person[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, timezone, user_roles!inner(role)")
    .eq("status", "active")
    .in("user_roles.role", roles);
  if (error) throw error;
  const unique = new Map(data.map((p) => [p.id, { id: p.id, name: p.name, email: p.email, timezone: p.timezone }]));
  return [...unique.values()];
}

export const INVOICE_FIELDS = `id, number, month, status, total_minor, submitted_at, review_deadline, approved_at, currency_code,
  currency:currencies(code, symbol, decimal_places),
  employee:profiles!invoices_employee_id_fkey(name)`;

type JobInvoice = {
  id: string;
  number: string | null;
  month: string;
  status: InvoiceStatus;
  total_minor: number;
  submitted_at: string | null;
  review_deadline: string | null;
  approved_at: string | null;
  currency_code: string;
  currency: { code: string; symbol: string; decimal_places: number } | null;
  employee: { name: string } | null;
};

/** An invoice as one row of an email, dated in the reader's timezone. */
export function toRow(
  invoice: JobInvoice,
  dateOf: "submitted" | "deadline" | "approved",
  timeZone: string,
  now = new Date(),
): InvoiceRow {
  const iso = { submitted: invoice.submitted_at, deadline: invoice.review_deadline, approved: invoice.approved_at }[dateOf];
  return {
    employee: invoice.employee?.name ?? "Unknown",
    number: invoice.number ?? "—",
    month: formatMonth(invoice.month),
    total: invoice.currency ? formatMoney(invoice.total_minor, invoice.currency) : String(invoice.total_minor),
    currency: invoice.currency_code,
    status: isOverdue(invoice, now) ? "Overdue" : STATUS_LABELS[invoice.status],
    date: iso ? formatDate(iso, timeZone) : "",
    link: appUrl(`/invoices/${invoice.id}`),
  };
}

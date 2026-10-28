import "server-only";
import { isOverdue, type InvoiceStatus } from "@/src/domain/invoice";
import { createClient } from "@/src/supabase/server";

// Reads for the approver and accounts pages. Row-level security only lets
// staff with two-factor see everyone's invoices.

const LIST_FIELDS = `id, number, month, status, subtotal_minor, tax_total_minor, total_minor, exchange_rate_to_base,
  submitted_at, review_deadline, review_started_at, approved_at, paid_at, marked_paid_by, employee_reference,
  currency:currencies(code, symbol, decimal_places),
  employee:profiles!invoices_employee_id_fkey(id, name, employee_code),
  payments(wise_transfer_id, amount_sent_minor, sent_currency, wise_fee_minor, fee_paid_by, amount_received_minor,
    received_currency, actual_exchange_rate, confirmed_by_accounts_at, paid_at)`;

export type StaffInvoice = Awaited<ReturnType<typeof listInvoices>>[number];

export type InvoiceFilters = {
  employee?: string;
  month?: string; // YYYY-MM
  currency?: string;
  status?: InvoiceStatus | "overdue" | "unconfirmed";
};

export async function listInvoices(filters: InvoiceFilters = {}) {
  const supabase = await createClient();
  let query = supabase.from("invoices").select(LIST_FIELDS).neq("status", "draft");

  if (filters.employee) query = query.eq("employee_id", filters.employee);
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) query = query.eq("month", `${filters.month}-01`);
  if (filters.currency) query = query.eq("currency_code", filters.currency);
  if (filters.status === "overdue") {
    query = query.eq("status", "submitted").lt("review_deadline", new Date().toISOString());
  } else if (filters.status === "unconfirmed") {
    query = query.eq("status", "paid");
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("month", { ascending: false }).order("number");
  if (error) throw error;

  return filters.status === "unconfirmed"
    ? data.filter((i) => !i.payments.some((p) => p.confirmed_by_accounts_at))
    : data;
}

/**
 * The approver's queue, in the order of the daily summary: overdue first,
 * then waiting for approval (soonest deadline first), then approved and
 * waiting to be marked paid.
 */
export async function getApproverQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(LIST_FIELDS)
    .in("status", ["submitted", "approved"])
    .order("review_deadline", { ascending: true })
    .order("approved_at", { ascending: true });
  if (error) throw error;

  const now = new Date();
  return {
    overdue: data.filter((i) => isOverdue(i, now)),
    waiting: data.filter((i) => i.status === "submitted" && !isOverdue(i, now)),
    toPay: data.filter((i) => i.status === "approved"),
  };
}

/** Employees for the accounts filter. */
export async function listEmployees() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, employee_code, user_roles!inner(role)")
    .eq("user_roles.role", "employee")
    .order("name");
  if (error) throw error;
  return data.map(({ id, name, employee_code }) => ({ id, name, employee_code }));
}

export async function listCurrencies() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("currencies").select("code, symbol, decimal_places").order("code");
  if (error) throw error;
  return data;
}

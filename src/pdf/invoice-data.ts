import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, formatMonth } from "@/src/domain/format";
import { STATUS_LABELS } from "@/src/domain/invoice";
import { formatMoney } from "@/src/domain/money";
import type { Database } from "@/src/supabase/database.types";
import type { InvoicePdfData } from "./invoice-pdf";

/**
 * Collects what the invoice PDF needs. Pass the signed-in user's client to
 * respect row-level security (a page download), or the admin client for
 * scheduled jobs. Returns null when the invoice is not visible.
 */
export async function loadInvoicePdfData(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  timeZone = "Asia/Colombo",
): Promise<InvoicePdfData | null> {
  const [{ data: invoice }, { data: companySetting }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `number, month, status, submitted_at, currency_code, employee_reference, subtotal_minor, total_minor,
         currency:currencies(code, symbol, decimal_places),
         employee:profiles!invoices_employee_id_fkey(name, employee_code, address, nic_or_tin),
         lines:line_items(description, quantity, rate_minor, tax_minor, line_total_minor, position, created_at,
           line_type:line_types(name), tax_rate:tax_rates(label, percentage))`,
      )
      .eq("id", invoiceId)
      .order("position", { referencedTable: "line_items" })
      .order("created_at", { referencedTable: "line_items" })
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "company").maybeSingle(),
  ]);
  if (!invoice || !invoice.currency || !invoice.employee) return null;

  const company = (companySetting?.value ?? {}) as { name?: string; business_number?: string; address?: string };
  const money = (minor: number) => formatMoney(minor, invoice.currency!);

  const taxes = new Map<string, number>();
  for (const l of invoice.lines) {
    if (l.tax_rate && l.tax_minor > 0) {
      const key = `${l.tax_rate.label} ${l.tax_rate.percentage}%`;
      taxes.set(key, (taxes.get(key) ?? 0) + l.tax_minor);
    }
  }

  return {
    company: {
      name: company.name || "QNetwork",
      businessNumber: company.business_number ?? "",
      address: company.address ?? "",
    },
    worker: {
      name: invoice.employee.name,
      code: invoice.employee.employee_code,
      address: invoice.employee.address,
      nicOrTin: invoice.employee.nic_or_tin,
    },
    invoice: {
      number: invoice.number,
      month: formatMonth(invoice.month),
      status: STATUS_LABELS[invoice.status],
      submitted: invoice.submitted_at ? formatDate(invoice.submitted_at, timeZone) : null,
      currency: invoice.currency_code,
      reference: invoice.employee_reference,
    },
    lines: invoice.lines.map((l) => ({
      type: l.line_type?.name ?? "",
      description: l.description,
      quantity: String(l.quantity),
      rate: money(l.rate_minor),
      tax: l.tax_rate ? `${l.tax_rate.percentage}%` : "—",
      amount: money(l.line_total_minor),
    })),
    totals: {
      subtotal: money(invoice.subtotal_minor),
      taxes: [...taxes].map(([label, amount]) => ({ label, amount: money(amount) })),
      total: money(invoice.total_minor),
    },
  };
}

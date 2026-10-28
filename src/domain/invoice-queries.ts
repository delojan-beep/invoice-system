import "server-only";
import { createClient } from "@/src/supabase/server";

// Reads for invoice pages. Row-level security decides what each viewer sees,
// so these return null / empty rather than other people's data.

const CURRENCY = "currency:currencies(code, name, symbol, decimal_places)";

export async function listMyInvoices(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`id, number, month, status, total_minor, submitted_at, review_deadline, review_started_at, ${CURRENCY}`)
    .eq("employee_id", employeeId)
    .order("month", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `*, ${CURRENCY},
       lines:line_items(*,
         line_type:line_types(id, name, receipt_required),
         tax_rate:tax_rates(id, name, percentage, label),
         attachments(id, file_name, mime_type, size_bytes, created_at)),
       events:approval_events(id, action, actor_id, previous_status, new_status, comment, system_note, created_at),
       payments(id, amount_received_minor, received_currency, paid_at, recorded_by)`,
    )
    .eq("id", invoiceId)
    .order("position", { referencedTable: "line_items" })
    .order("created_at", { referencedTable: "line_items" })
    .order("created_at", { referencedTable: "approval_events" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
export type InvoiceLine = InvoiceDetail["lines"][number];

/** Choices for the invoice forms: active line types, currencies, and tax rates for one currency. */
export async function getFormOptions(currencyCode: string) {
  const supabase = await createClient();
  const [lineTypes, taxRates, currencies] = await Promise.all([
    supabase.from("line_types").select("id, name, receipt_required").eq("active", true).order("sort_order"),
    supabase
      .from("tax_rates")
      .select("id, name, percentage, label")
      .eq("active", true)
      .eq("currency_code", currencyCode)
      .order("percentage"),
    supabase.from("currencies").select("code, name, symbol, decimal_places").eq("active", true).order("code"),
  ]);
  for (const r of [lineTypes, taxRates, currencies]) if (r.error) throw r.error;
  return { lineTypes: lineTypes.data!, taxRates: taxRates.data!, currencies: currencies.data! };
}

export type FormOptions = Awaited<ReturnType<typeof getFormOptions>>;

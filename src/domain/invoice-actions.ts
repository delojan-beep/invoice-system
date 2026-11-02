import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/src/supabase/server";

// Typed calls to the invoice functions in the database. The database checks
// who may do what; callers still run requireAccess() first so people get a
// redirect rather than an error. Each returns a result the form can show.

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const FORBIDDEN = "You don't have permission to do that.";
const NOT_FOUND = "That invoice could not be found.";
const UNEXPECTED = "Something went wrong. Please try again.";

/** Rule errors (P0001) carry a message written for people; others get a generic one. */
export function toResult<T>(data: T, error: PostgrestError | null): ActionResult<T> {
  if (!error) return { ok: true, data };
  switch (error.code) {
    case "P0001":
      return { ok: false, error: error.message };
    case "P0002":
      return { ok: false, error: NOT_FOUND };
    case "42501":
      return { ok: false, error: FORBIDDEN };
    default:
      console.error("Invoice action failed", error);
      return { ok: false, error: UNEXPECTED };
  }
}

/** This month's invoice for the signed-in employee, created as a draft if needed. */
export async function ensureMonthlyDraft(month?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_monthly_draft", month ? { p_month: month } : {});
  return toResult(data, error);
}

export async function updateInvoiceDetails(invoiceId: string, currency: string, reference: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_invoice_details", {
    p_invoice: invoiceId,
    p_currency: currency,
    p_reference: reference,
  });
  return toResult(null, error);
}

/** Returns the invoice number assigned (or kept) on submission. */
export async function submitInvoice(invoiceId: string, confirmed: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_invoice", { p_invoice: invoiceId, p_confirmed: confirmed });
  return toResult(data, error);
}

export async function recallInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recall_invoice", { p_invoice: invoiceId });
  return toResult(null, error);
}

/** Call when the approver opens an invoice: from then on the employee cannot recall it. */
export async function openForReview(invoiceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_for_review", { p_invoice: invoiceId });
  return toResult(null, error);
}

/** All or none: one invoice that is not waiting stops the batch. */
export async function approveInvoices(invoiceIds: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_invoices", { p_invoices: invoiceIds });
  return toResult(data, error);
}

export async function rejectInvoice(invoiceId: string, comment: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_invoice", { p_invoice: invoiceId, p_comment: comment });
  return toResult(null, error);
}

export async function markInvoicesPaid(
  invoiceIds: string[],
  received?: { amountMinor: number; currency?: string },
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_invoices_paid", {
    p_invoices: invoiceIds,
    ...(received && { p_amount_received_minor: received.amountMinor, p_received_currency: received.currency }),
  });
  return toResult(data, error);
}

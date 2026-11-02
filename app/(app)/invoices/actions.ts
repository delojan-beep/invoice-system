"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/src/auth/dal";
import {
  approveInvoices,
  markInvoicesPaid,
  openForReview,
  rejectInvoice,
  toResult,
  type ActionResult,
} from "@/src/domain/invoice-actions";
import { parseAmount } from "@/src/domain/money";
import { sendStatusEmails } from "@/src/email/status";
import { createClient } from "@/src/supabase/server";

// Approver and accounts actions. Each checks the role here and the database
// checks it again (with two-factor) before anything changes.

export type FormState = { error?: string; message?: string };

function done<T>(result: ActionResult<T>, message?: string): FormState {
  if (!result.ok) return { error: result.error };
  refresh();
  return message ? { message } : {};
}

const ids = z.array(z.uuid()).min(1, "Tick at least one invoice");

/** Emails the employees once the response is sent; a failed email never undoes the action. */
function emailEmployees<T>(result: ActionResult<T>, invoiceIds: string[], event: "approved" | "rejected" | "paid", comment?: string) {
  if (result.ok) after(() => sendStatusEmails(invoiceIds, event, comment));
  return result;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// --- Approver -------------------------------------------------------------

export async function approveSelected(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["approver"]);
  const parsed = ids.safeParse(formData.getAll("ids"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = emailEmployees(await approveInvoices(parsed.data), parsed.data, "approved");
  return done(result, result.ok ? `Approved ${plural(result.data ?? 0, "invoice")}` : undefined);
}

export async function markSelectedPaid(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["approver"]);
  const parsed = ids.safeParse(formData.getAll("ids"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = emailEmployees(await markInvoicesPaid(parsed.data), parsed.data, "paid");
  return done(result, result.ok ? `Marked ${plural(result.data ?? 0, "invoice")} paid` : undefined);
}

export async function approve(invoiceId: string): Promise<FormState> {
  await requireAccess(["approver"]);
  return done(emailEmployees(await approveInvoices([invoiceId]), [invoiceId], "approved"), "Approved");
}

export async function reject(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["approver"]);
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "Say what needs fixing" };
  const text = comment.slice(0, 2000);
  return done(emailEmployees(await rejectInvoice(invoiceId, text), [invoiceId], "rejected", text), "Sent back to the employee");
}

export async function markPaid(invoiceId: string): Promise<FormState> {
  await requireAccess(["approver"]);
  return done(emailEmployees(await markInvoicesPaid([invoiceId]), [invoiceId], "paid"), "Marked paid");
}

/** Called once when the approver opens a submitted invoice: it can no longer be recalled. */
export async function startReview(invoiceId: string): Promise<void> {
  await requireAccess(["approver"]);
  const result = await openForReview(invoiceId);
  if (result.ok) refresh();
}

// --- Accounts -------------------------------------------------------------

const confirmSchema = z.object({
  transferId: z.string().trim().min(1, "Add the Wise transfer ID").max(100),
  sent: z.string().trim().min(1, "Add the amount sent"),
  sentCurrency: z.string().regex(/^[A-Z]{3}$/),
  fee: z.string().trim(),
  feePaidBy: z.enum(["company", "deducted"], { error: "Choose who paid the Wise fee" }),
  received: z.string().trim().min(1, "Add the amount received"),
  receivedCurrency: z.string().regex(/^[A-Z]{3}$/),
  rate: z.string().trim(),
});

export async function confirmPayment(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["accounts"]);
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  const supabase = await createClient();
  const { data: currencies } = await supabase.from("currencies").select("code, decimal_places");
  const places = (code: string) => currencies?.find((c) => c.code === code)?.decimal_places ?? 2;

  const sent = parseAmount(f.sent, places(f.sentCurrency));
  const received = parseAmount(f.received, places(f.receivedCurrency));
  const fee = f.fee ? parseAmount(f.fee, places(f.sentCurrency)) : 0;
  const rate = f.rate ? Number(f.rate) : null;
  if (sent === null) return { error: "Enter the amount sent as a number" };
  if (received === null) return { error: "Enter the amount received as a number" };
  if (fee === null) return { error: "Enter the Wise fee as a number, or leave it blank" };
  if (rate !== null && !(rate > 0)) return { error: "Enter the exchange rate as a positive number, or leave it blank" };

  const { error } = await supabase.rpc("confirm_payment", {
    p_invoice: invoiceId,
    p_wise_transfer_id: f.transferId,
    p_amount_sent_minor: sent,
    p_sent_currency: f.sentCurrency,
    p_wise_fee_minor: fee,
    p_fee_paid_by: f.feePaidBy,
    p_amount_received_minor: received,
    p_received_currency: f.receivedCurrency,
    // Optional: the function accepts null, but generated types mark every argument required.
    p_actual_rate: rate as number,
  });
  return done(toResult(null, error), "Payment confirmed");
}

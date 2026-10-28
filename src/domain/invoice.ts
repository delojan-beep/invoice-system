// Invoice rules the screens need before asking the database: status labels,
// what each person may do next, and line maths for live totals.
// The database (supabase/migrations/*_invoice_core.sql) is the authority;
// these mirror it so forms can show the same numbers while typing.

import type { Database } from "@/src/supabase/database.types";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

/** The employee may still change lines, attachments and details. */
export function isEditable(status: InvoiceStatus) {
  return status === "draft" || status === "rejected";
}

/** Submitted and not reviewed by the deadline. */
export function isOverdue(invoice: { status: InvoiceStatus; review_deadline: string | null }, now = new Date()) {
  return invoice.status === "submitted" && invoice.review_deadline !== null && new Date(invoice.review_deadline) < now;
}

export type InvoiceAction = "edit" | "submit" | "recall" | "approve" | "reject" | "mark_paid";

type ActionContext = {
  status: InvoiceStatus;
  review_started_at: string | null;
  isOwner: boolean;
  isApprover: boolean;
};

/** What the viewer can do with this invoice now, for showing buttons. */
export function allowedActions({ status, review_started_at, isOwner, isApprover }: ActionContext): InvoiceAction[] {
  const actions: InvoiceAction[] = [];
  if (isOwner && isEditable(status)) actions.push("edit", "submit");
  if (isOwner && status === "submitted" && review_started_at === null) actions.push("recall");
  if (isApprover && status === "submitted") actions.push("approve", "reject");
  if ((isOwner || isApprover) && status === "approved") actions.push("mark_paid");
  return actions;
}

// Integer maths in BigInt so 0.285 x 1000 is exactly 285, as in Postgres numeric.
// quantity has up to 3 decimals and tax percentages up to 3 decimals.
function thousandths(value: number) {
  return BigInt(Math.round(value * 1000));
}

/** Rounds num/den half-up for non-negative values. */
function roundDiv(num: bigint, den: bigint) {
  return (num * 2n + den) / (den * 2n);
}

/**
 * Line amount before tax and the line's tax, in minor units:
 *   line total = round(quantity x rate), tax = round(line total x percent / 100)
 */
export function lineAmounts(quantity: number, rateMinor: number, taxPercent: number | null) {
  const lineTotal = roundDiv(thousandths(quantity) * BigInt(rateMinor), 1000n);
  const tax = taxPercent ? roundDiv(lineTotal * thousandths(taxPercent), 100_000n) : 0n;
  return { lineTotalMinor: Number(lineTotal), taxMinor: Number(tax) };
}

/** Subtotal, tax and total of an invoice's lines. */
export function invoiceTotals(lines: { lineTotalMinor: number; taxMinor: number }[]) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const taxTotalMinor = lines.reduce((sum, l) => sum + l.taxMinor, 0);
  return { subtotalMinor, taxTotalMinor, totalMinor: subtotalMinor + taxTotalMinor };
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Where an attachment is stored: <employee>/<invoice>/<unique name>. */
export function attachmentPath(employeeId: string, invoiceId: string, fileName: string, unique: string) {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  return `${employeeId}/${invoiceId}/${unique}-${safe}`;
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/src/auth/dal";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/src/domain/invoice";
import {
  markInvoicesPaid,
  recallInvoice,
  submitInvoice,
  toResult,
  updateInvoiceDetails,
  type ActionResult,
} from "@/src/domain/invoice-actions";
import { parseAmount } from "@/src/domain/money";
import { createClient } from "@/src/supabase/server";

// Every action: check the employee, validate, let the database enforce the
// rules, then refresh the page. Errors come back as text for the form.

export type FormState = { error?: string; message?: string };

function done<T>(result: ActionResult<T>, message?: string): FormState {
  if (!result.ok) return { error: result.error };
  refresh();
  return message ? { message } : {};
}

async function currencyPlaces(currencyCode: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("currencies").select("decimal_places").eq("code", currencyCode).single();
  return data?.decimal_places ?? 2;
}

// --- Details --------------------------------------------------------------

export async function saveDetails(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["employee"]);
  const reference = String(formData.get("reference") ?? "").slice(0, 200);
  const currency = formData.get("currency");

  if (typeof currency === "string") {
    return done(await updateInvoiceDetails(invoiceId, currency, reference), "Saved");
  }
  // Locked invoices: only "My reference" can change.
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_invoice_reference", { p_invoice: invoiceId, p_reference: reference });
  return done(toResult(null, error), "Saved");
}

// --- Lines ----------------------------------------------------------------

const lineSchema = z.object({
  lineTypeId: z.uuid({ error: "Choose a line type" }),
  description: z.string().trim().min(1, "Add a description").max(500, "Keep the description under 500 characters"),
  quantity: z.coerce
    .number({ error: "Quantity must be a number" })
    .positive("Quantity must be more than zero")
    .max(100000, "Quantity is too large")
    .refine((q) => Math.abs(q * 1000 - Math.round(q * 1000)) < 1e-6, { error: "Use at most 3 decimals for quantity" }),
  rate: z.string().trim().min(1, "Add a rate"),
  taxRateId: z.union([z.uuid(), z.literal("")]).optional(),
});

export async function saveLine(
  invoiceId: string,
  currencyCode: string,
  lineId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAccess(["employee"]);
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const places = await currencyPlaces(currencyCode);
  const rateMinor = parseAmount(parsed.data.rate, places);
  if (rateMinor === null) {
    return { error: `Enter the rate as an amount, like 1500${places ? "." + "0".repeat(places) : ""}` };
  }

  const row = {
    line_type_id: parsed.data.lineTypeId,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    rate_minor: rateMinor,
    tax_rate_id: parsed.data.taxRateId || null,
  };

  const supabase = await createClient();
  if (lineId) {
    const { error } = await supabase.from("line_items").update(row).eq("id", lineId).eq("invoice_id", invoiceId);
    return done(toResult(null, error));
  }

  const { count } = await supabase
    .from("line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
  const { error } = await supabase.from("line_items").insert({ ...row, invoice_id: invoiceId, position: count ?? 0 });
  return done(toResult(null, error));
}

export async function deleteLine(invoiceId: string, lineId: string): Promise<FormState> {
  await requireAccess(["employee"]);
  const supabase = await createClient();

  const { data: files } = await supabase.from("attachments").select("storage_path").eq("line_item_id", lineId);
  const { error } = await supabase.from("line_items").delete().eq("id", lineId).eq("invoice_id", invoiceId);
  if (error) return done(toResult(null, error));

  // The rows are gone (and audited); now the stored files.
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) await supabase.storage.from("attachments").remove(paths);
  return done({ ok: true, data: null });
}

// --- Attachments ----------------------------------------------------------
// The browser uploads the file to Storage first, then calls this to record it.

const attachmentSchema = z.object({
  path: z.string().min(1).max(400),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ATTACHMENT_TYPES),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export async function recordAttachment(
  lineId: string,
  file: { path: string; fileName: string; mimeType: string; size: number },
): Promise<FormState> {
  const viewer = await requireAccess(["employee"]);
  const parsed = attachmentSchema.safeParse(file);
  const supabase = await createClient();

  if (!parsed.success) {
    await supabase.storage.from("attachments").remove([file.path]);
    return { error: "Attach a PDF, JPG or PNG up to 10 MB." };
  }

  const { error } = await supabase.from("attachments").insert({
    line_item_id: lineId,
    storage_path: parsed.data.path,
    file_name: parsed.data.fileName,
    mime_type: parsed.data.mimeType,
    size_bytes: parsed.data.size,
    uploaded_by: viewer.id,
  });
  if (error) await supabase.storage.from("attachments").remove([parsed.data.path]);
  return done(toResult(null, error));
}

export async function removeAttachment(attachmentId: string): Promise<FormState> {
  await requireAccess(["employee"]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("attachments").delete().eq("id", attachmentId).select("storage_path");
  if (error) return done(toResult(null, error));
  if (data?.length) await supabase.storage.from("attachments").remove(data.map((d) => d.storage_path));
  return done({ ok: true, data: null });
}

// --- Status changes -------------------------------------------------------

export async function submit(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["employee"]);
  const result = await submitInvoice(invoiceId, formData.get("confirmed") === "on");
  return done(result, result.ok ? `Submitted as ${result.data}` : undefined);
}

export async function recall(invoiceId: string): Promise<FormState> {
  await requireAccess(["employee"]);
  return done(await recallInvoice(invoiceId), "Recalled to draft");
}

export async function markPaid(
  invoiceId: string,
  currencyCode: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAccess(["employee"]);
  const typed = String(formData.get("amount") ?? "").trim();
  const receivedCurrency = String(formData.get("receivedCurrency") || currencyCode);

  let received: { amountMinor: number; currency: string } | undefined;
  if (typed) {
    const amountMinor = parseAmount(typed, await currencyPlaces(receivedCurrency));
    if (amountMinor === null) return { error: "Enter the amount received as a number, or leave it blank" };
    received = { amountMinor, currency: receivedCurrency };
  }
  return done(await markInvoicesPaid([invoiceId], received), "Marked as paid");
}

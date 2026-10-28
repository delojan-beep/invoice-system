import "server-only";
import { createAdminClient } from "@/src/supabase/admin";
import { deliver, type Email } from "./transport";

export type NotificationType =
  | "status_update"
  | "daily_summary"
  | "deadline_warning"
  | "overdue_alert"
  | "monthly_summary";

/**
 * Sends one email and logs it, success or failure. When one email covers
 * several invoices, one log row is written per invoice so jobs can tell what
 * each invoice has already been sent.
 */
export async function sendAndLog(type: NotificationType, email: Email, invoiceIds: (string | null)[] = [null]) {
  const supabase = createAdminClient();
  let status: "sent" | "failed" = "sent";
  let providerId: string | null = null;
  let error: string | null = null;

  try {
    providerId = await deliver(email);
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);
    console.error(`Email ${type} to ${email.to} failed:`, error);
  }

  const { error: logError } = await supabase.from("notification_logs").insert(
    (invoiceIds.length ? invoiceIds : [null]).map((invoiceId) => ({
      type,
      recipient: email.to,
      invoice_id: invoiceId,
      subject: email.subject,
      provider_message_id: providerId,
      status,
      error,
    })),
  );
  if (logError) console.error("Could not log email", logError);
  return status;
}

/** Records that a scheduled email was due but had nothing to say (so it is not retried today). */
export async function logSkipped(type: NotificationType, recipient: string, reason: string) {
  const supabase = createAdminClient();
  await supabase.from("notification_logs").insert({ type, recipient, status: "skipped", error: reason });
}

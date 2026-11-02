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
 * Sends one email and logs it, success or failure. Used for emails that follow
 * a person's action (status updates), where each action sends exactly once.
 */
export async function sendAndLog(type: NotificationType, email: Email, invoiceIds: (string | null)[] = [null]) {
  const supabase = createAdminClient();
  const { providerId, error } = await tryDeliver(type, email);
  const { error: logError } = await supabase.from("notification_logs").insert(
    (invoiceIds.length ? invoiceIds : [null]).map((invoiceId) => ({
      type,
      recipient: email.to,
      invoice_id: invoiceId,
      subject: email.subject,
      provider_message_id: providerId,
      status: error ? "failed" : "sent",
      error,
    })),
  );
  if (logError) console.error("Could not log email", logError);
  return error ? "failed" : "sent";
}

export type Claim = { invoiceId: string | null; period: string };

/**
 * For scheduled emails: claims each (invoice, period) in the log first, so a
 * repeated or overlapping run never sends twice, then builds the email from
 * only the invoices this run won. `build` returns null when there is nothing
 * to say this period (the claim is kept as "skipped").
 */
export async function sendOnce(
  type: NotificationType,
  recipient: string,
  claims: Claim[],
  build: (claimedInvoiceIds: string[]) => Email | null,
): Promise<"sent" | "failed" | "skipped" | "already sent"> {
  const supabase = createAdminClient();
  const { data: won, error } = await supabase.rpc("claim_notifications", {
    p_type: type,
    p_recipient: recipient,
    // Generated types say string[]; null is how an email that is not about an invoice is claimed.
    p_invoices: claims.map((c) => c.invoiceId) as string[],
    p_periods: claims.map((c) => c.period),
  });
  if (error) throw error;
  if (!won.length) return "already sent";

  const logIds = won.map((w) => w.claimed_log_id);
  const email = build(won.map((w) => w.claimed_invoice_id).filter(Boolean));
  const finish = (status: string, subject: string | null, providerId: string | null, err: string | null) =>
    supabase.rpc("finish_notifications", {
      p_log_ids: logIds,
      p_status: status,
      p_subject: subject as string,
      p_provider_message_id: providerId as string,
      p_error: err as string,
    });

  if (!email) {
    await finish("skipped", null, null, "Nothing to send");
    return "skipped";
  }

  const result = await tryDeliver(type, email);
  const { error: finishError } = await finish(result.error ? "failed" : "sent", email.subject, result.providerId, result.error);
  if (finishError) console.error("Could not log email", finishError);
  return result.error ? "failed" : "sent";
}

async function tryDeliver(type: NotificationType, email: Email) {
  try {
    return { providerId: await deliver(email), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email ${type} to ${email.to} failed:`, message);
    return { providerId: null, error: message };
  }
}

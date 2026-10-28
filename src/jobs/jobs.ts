import "server-only";
import { formatMonth } from "@/src/domain/format";
import { isOverdue } from "@/src/domain/invoice";
import { logSkipped, sendAndLog } from "@/src/email/notify";
import { dailySummary, deadlineWarning, monthlySummary, overdueAlert } from "@/src/email/templates";
import { createAdminClient } from "@/src/supabase/admin";
import { isDailyDue, isMonthlyDue, localTime, parseClock } from "./clock";
import { alreadySent, appUrl, getSettings, INVOICE_FIELDS, peopleWithRoles, toRow, type AppRole } from "./data";
import { fetchRates } from "./rates";

// Scheduled work, run every 15 minutes by /api/cron. Each job decides for
// itself whether it is due and what was already sent, so running it again
// (or late) never sends anything twice.

export type JobResult = { job: string; ok: boolean; detail: string };

/** This month's draft for every active employee, in their own timezone. */
export async function monthlyDrafts(): Promise<string> {
  const supabase = createAdminClient();
  const employees = await peopleWithRoles(["employee"]);
  const failed: string[] = [];
  for (const e of employees) {
    const { error } = await supabase.rpc("ensure_monthly_draft", { p_employee: e.id });
    if (error) failed.push(`${e.name}: ${error.message}`);
  }
  return failed.length
    ? `${employees.length - failed.length}/${employees.length} ok; ${failed.join("; ")}`
    : `${employees.length} employees have this month's invoice`;
}

/** Once a day, from the CEO's summary time: every invoice not yet marked paid. */
export async function dailySummaries(now: Date): Promise<string> {
  const settings = await getSettings();
  const at = parseClock(settings.daily_summary_time, "08:00");
  const fields = Array.isArray(settings.reminder_fields) ? (settings.reminder_fields as string[]) : ["number", "date", "total"];
  const supabase = createAdminClient();
  const results: string[] = [];

  for (const ceo of await peopleWithRoles(["approver"])) {
    if (!isDailyDue(now, ceo.timezone, at)) continue;
    const today = localTime(now, ceo.timezone).date;

    const { data: logs } = await supabase
      .from("notification_logs")
      .select("sent_at")
      .eq("type", "daily_summary")
      .eq("recipient", ceo.email)
      .in("status", ["sent", "skipped"])
      .gte("sent_at", new Date(now.getTime() - 36 * 3600 * 1000).toISOString());
    if (logs?.some((l) => localTime(new Date(l.sent_at), ceo.timezone).date === today)) continue;

    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_FIELDS)
      .in("status", ["submitted", "approved"])
      .order("review_deadline")
      .order("approved_at");
    if (error) throw error;

    const overdue = data.filter((i) => isOverdue(i, now));
    const waiting = data.filter((i) => i.status === "submitted" && !isOverdue(i, now));
    const toPay = data.filter((i) => i.status === "approved");

    if (data.length === 0) {
      await logSkipped("daily_summary", ceo.email, "Every invoice is paid");
      results.push(`${ceo.name}: nothing to send`);
      continue;
    }

    const email = dailySummary({
      recipientName: ceo.name,
      overdue: overdue.map((i) => toRow(i, "deadline", ceo.timezone, now)),
      waiting: waiting.map((i) => toRow(i, "deadline", ceo.timezone, now)),
      toPay: toPay.map((i) => toRow(i, "approved", ceo.timezone, now)),
      fields,
      link: appUrl("/approver"),
    });
    const status = await sendAndLog("daily_summary", { to: ceo.email, ...email }, data.map((i) => i.id));
    results.push(`${ceo.name}: ${status} (${data.length} invoices)`);
  }
  return results.join("; ") || "not due";
}

/** 24 hours before an invoice's review deadline, once per submission. */
export async function deadlineWarnings(now: Date): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_FIELDS)
    .eq("status", "submitted")
    .gt("review_deadline", now.toISOString())
    .lte("review_deadline", new Date(now.getTime() + 24 * 3600 * 1000).toISOString());
  if (error) throw error;

  const sent = await alreadySent("deadline_warning", data);
  const due = data.filter((i) => !sent.has(i.id));
  if (due.length === 0) return "none due";

  const results: string[] = [];
  for (const ceo of await peopleWithRoles(["approver"])) {
    const email = deadlineWarning({
      recipientName: ceo.name,
      invoices: due.map((i) => toRow(i, "deadline", ceo.timezone, now)),
      link: appUrl("/approver"),
    });
    results.push(`${ceo.name}: ${await sendAndLog("deadline_warning", { to: ceo.email, ...email }, due.map((i) => i.id))}`);
  }
  return `${due.length} invoices; ${results.join("; ")}`;
}

/** Once, when the review deadline passes without approval: tell accounts. */
export async function overdueAlerts(now: Date): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_FIELDS)
    .eq("status", "submitted")
    .lte("review_deadline", now.toISOString());
  if (error) throw error;

  const sent = await alreadySent("overdue_alert", data);
  const due = data.filter((i) => !sent.has(i.id));
  if (due.length === 0) return "none due";

  const results: string[] = [];
  for (const person of await peopleWithRoles(["accounts"])) {
    const email = overdueAlert({
      recipientName: person.name,
      invoices: due.map((i) => toRow(i, "deadline", person.timezone, now)),
      link: appUrl("/accounts?status=overdue"),
    });
    results.push(`${person.name}: ${await sendAndLog("overdue_alert", { to: person.email, ...email }, due.map((i) => i.id))}`);
  }
  return `${due.length} invoices; ${results.join("; ")}`;
}

/** Monthly summary to the CEO and accounts (default: 15th, 6:30 PM Sri Lanka time). */
export async function monthlySummaries(now: Date): Promise<string> {
  const settings = await getSettings();
  const cfg = (settings.monthly_summary ?? {}) as { day?: number; time?: string; timezone?: string };
  const tz = cfg.timezone ?? "Asia/Colombo";
  const day = Number(cfg.day) || 15;
  if (!isMonthlyDue(now, tz, day, parseClock(cfg.time, "18:30"))) return "not due";

  const local = localTime(now, tz);
  const roles = (Array.isArray(settings.summary_recipients) ? settings.summary_recipients : ["approver", "accounts"]) as AppRole[];
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_FIELDS)
    .eq("month", `${local.month}-01`)
    .neq("status", "draft")
    .order("number");
  if (error) throw error;

  const results: string[] = [];
  for (const person of await peopleWithRoles(roles)) {
    const { data: logs } = await supabase
      .from("notification_logs")
      .select("sent_at")
      .eq("type", "monthly_summary")
      .eq("recipient", person.email)
      .eq("status", "sent")
      .gte("sent_at", new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString());
    if (logs?.some((l) => localTime(new Date(l.sent_at), tz).month === local.month)) continue;

    // Invoice PDFs are attached once PDF generation lands (M6).
    const email = monthlySummary({
      recipientName: person.name,
      month: formatMonth(`${local.month}-01`),
      rows: data.map((i) => toRow(i, "submitted", person.timezone, now)),
      link: appUrl(`/accounts?month=${local.month}`),
    });
    results.push(`${person.name}: ${await sendAndLog("monthly_summary", { to: person.email, ...email }, [null])}`);
  }
  return results.join("; ") || "already sent this month";
}

/** Runs every job; one failing job does not stop the others. */
export async function runJobs(now: Date): Promise<JobResult[]> {
  const jobs: [string, () => Promise<string>][] = [
    ["monthly_drafts", () => monthlyDrafts()],
    ["exchange_rates", () => fetchRates(now)],
    ["deadline_warnings", () => deadlineWarnings(now)],
    ["overdue_alerts", () => overdueAlerts(now)],
    ["daily_summary", () => dailySummaries(now)],
    ["monthly_summary", () => monthlySummaries(now)],
  ];
  const results: JobResult[] = [];
  for (const [job, run] of jobs) {
    try {
      results.push({ job, ok: true, detail: await run() });
    } catch (err) {
      console.error(`Job ${job} failed`, err);
      results.push({ job, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

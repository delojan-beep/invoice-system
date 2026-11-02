import "server-only";
import { formatMonth } from "@/src/domain/format";
import { isOverdue } from "@/src/domain/invoice";
import { sendOnce } from "@/src/email/notify";
import { dailySummary, deadlineWarning, monthlySummary, overdueAlert } from "@/src/email/templates";
import { createAdminClient } from "@/src/supabase/admin";
import { isDailyDue, isMonthlyDue, localTime, parseClock } from "./clock";
import { appUrl, getSettings, INVOICE_FIELDS, peopleWithRoles, toRow, type AppRole } from "./data";
import { fetchRates } from "./rates";

// Scheduled work, run every 15 minutes by /api/cron. Each job decides whether
// it is due; sendOnce claims each email in the log before sending, so running
// again, late, or twice at once never sends anything twice.

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

    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_FIELDS)
      .in("status", ["submitted", "approved"])
      .order("review_deadline")
      .order("approved_at");
    if (error) throw error;

    // One per local day; no email (but the day is marked done) when everything is paid.
    const today = localTime(now, ceo.timezone).date;
    const status = await sendOnce("daily_summary", ceo.email, [{ invoiceId: null, period: today }], () => {
      if (data.length === 0) return null;
      return {
        to: ceo.email,
        ...dailySummary({
          recipientName: ceo.name,
          overdue: data.filter((i) => isOverdue(i, now)).map((i) => toRow(i, "deadline", ceo.timezone, now)),
          waiting: data
            .filter((i) => i.status === "submitted" && !isOverdue(i, now))
            .map((i) => toRow(i, "deadline", ceo.timezone, now)),
          toPay: data.filter((i) => i.status === "approved").map((i) => toRow(i, "approved", ceo.timezone, now)),
          fields,
          link: appUrl("/approver"),
        }),
      };
    });
    results.push(`${ceo.name} (${today}): ${status}${status === "sent" ? ` (${data.length} invoices)` : ""}`);
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
  if (data.length === 0) return "none due";

  const results: string[] = [];
  for (const ceo of await peopleWithRoles(["approver"])) {
    const status = await sendOnce(
      "deadline_warning",
      ceo.email,
      data.map((i) => ({ invoiceId: i.id, period: i.submitted_at ?? "" })),
      (claimed) => ({
        to: ceo.email,
        ...deadlineWarning({
          recipientName: ceo.name,
          invoices: data.filter((i) => claimed.includes(i.id)).map((i) => toRow(i, "deadline", ceo.timezone, now)),
          link: appUrl("/approver"),
        }),
      }),
    );
    results.push(`${ceo.name}: ${status}`);
  }
  return `${data.length} due; ${results.join("; ")}`;
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
  if (data.length === 0) return "none overdue";

  const results: string[] = [];
  for (const person of await peopleWithRoles(["accounts"])) {
    const status = await sendOnce(
      "overdue_alert",
      person.email,
      data.map((i) => ({ invoiceId: i.id, period: i.submitted_at ?? "" })),
      (claimed) => ({
        to: person.email,
        ...overdueAlert({
          recipientName: person.name,
          invoices: data.filter((i) => claimed.includes(i.id)).map((i) => toRow(i, "deadline", person.timezone, now)),
          link: appUrl("/accounts?status=overdue"),
        }),
      }),
    );
    results.push(`${person.name}: ${status}`);
  }
  return `${data.length} overdue; ${results.join("; ")}`;
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
    // Invoice PDFs are attached once PDF generation lands (M6).
    const status = await sendOnce("monthly_summary", person.email, [{ invoiceId: null, period: local.month }], () => ({
      to: person.email,
      ...monthlySummary({
        recipientName: person.name,
        month: formatMonth(`${local.month}-01`),
        rows: data.map((i) => toRow(i, "submitted", person.timezone, now)),
        link: appUrl(`/accounts?month=${local.month}`),
      }),
    }));
    results.push(`${person.name} (${local.month}): ${status}`);
  }
  return results.join("; ");
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

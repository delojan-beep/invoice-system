import "server-only";
import { formatMonth } from "@/src/domain/format";
import { formatMoney } from "@/src/domain/money";
import { appUrl } from "@/src/jobs/data";
import { createAdminClient } from "@/src/supabase/admin";
import { sendAndLog } from "./notify";
import { statusUpdate } from "./templates";

/**
 * Tells each employee their invoice was approved, rejected, or marked paid by
 * the CEO. Called after the action succeeds (via after()), so a slow or failed
 * email never blocks or undoes the action; failures are in the notification log.
 */
export async function sendStatusEmails(invoiceIds: string[], event: "approved" | "rejected" | "paid", comment?: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`id, number, month, total_minor, currency:currencies(code, symbol, decimal_places),
      employee:profiles!invoices_employee_id_fkey(name, email)`)
    .in("id", invoiceIds);
  if (error) {
    console.error("Status emails: could not load invoices", error);
    return;
  }

  for (const invoice of data) {
    if (!invoice.employee) continue;
    const email = statusUpdate({
      employeeName: invoice.employee.name,
      month: formatMonth(invoice.month),
      number: invoice.number ?? "",
      total: invoice.currency ? formatMoney(invoice.total_minor, invoice.currency) : "",
      event,
      comment,
      link: appUrl(`/employee/invoices/${invoice.id}`),
    });
    await sendAndLog("status_update", { to: invoice.employee.email, ...email }, [invoice.id]);
  }
}

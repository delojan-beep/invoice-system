import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/src/auth/dal";
import { formatDate, formatDateTime, formatMonth } from "@/src/domain/format";
import { ACTION_LABELS } from "@/src/domain/history";
import { isOverdue } from "@/src/domain/invoice";
import { getInvoice } from "@/src/domain/invoice-queries";
import { formatMoney } from "@/src/domain/money";
import { listCurrencies } from "@/src/domain/staff-queries";
import { createClient } from "@/src/supabase/server";
import { ActionButton } from "@/src/ui/action-button";
import { Card, StatusBadge } from "@/src/ui/controls";
import { InvoiceLines } from "@/src/ui/invoice-lines";
import { approve, confirmPayment, markPaid, reject, startReview } from "../actions";
import { ConfirmPaymentForm, RejectForm, ReviewStarter } from "./forms";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

// One invoice as staff see it: the approver reviews and pays, accounts confirm payment.
export default async function StaffInvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const viewer = await requireAccess(["approver", "accounts", "admin"]);
  const { id } = await params;
  const { from } = await searchParams;

  const invoice = await getInvoice(id);
  if (!invoice || !invoice.currency || invoice.status === "draft") notFound();

  const currencies = await listCurrencies();
  const supabase = await createClient();
  const { data: feeSetting } = await supabase.from("settings").select("value").eq("key", "wise_fee_payer").maybeSingle();

  const tz = viewer.timezone;
  const currency = invoice.currency;
  const isApprover = viewer.roles.includes("approver");
  const isAccounts = viewer.roles.includes("accounts");
  const payment = invoice.payments.at(-1);
  const back = from === "accounts" || !isApprover ? "/accounts" : "/approver";
  const places = (code: string | null) => currencies.find((c) => c.code === code)?.decimal_places ?? 2;
  const amount = (minor: number | null, code: string | null) =>
    minor === null ? "" : (minor / 10 ** places(code)).toFixed(places(code));
  const money = (minor: number | null, code: string | null) => {
    const c = currencies.find((x) => x.code === code);
    return minor === null || !c ? "—" : formatMoney(minor, c);
  };

  return (
    <div className="flex flex-col gap-8">
      {isApprover && invoice.status === "submitted" && !invoice.review_started_at && (
        <ReviewStarter start={startReview.bind(null, invoice.id)} />
      )}

      <div>
        <Link href={back} className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
          ← {back === "/accounts" ? "All invoices" : "Approvals"}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-title font-medium text-ink-900">
              {invoice.employee?.name} · {formatMonth(invoice.month)}
            </h1>
            <StatusBadge status={invoice.status} overdue={isOverdue(invoice)} />
          </div>
          <p className="text-amount font-medium text-brand-900">{formatMoney(invoice.total_minor, currency)}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-base text-ink-600">{invoice.number}</p>
          <a href={`/pdf/${invoice.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-base font-medium text-brand-700 hover:underline">Download PDF</a>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base text-ink-600">
          {invoice.submitted_at && <div>Submitted {formatDate(invoice.submitted_at, tz)}</div>}
          {invoice.status === "submitted" && invoice.review_deadline && (
            <div className={isOverdue(invoice) ? "font-medium text-red-700" : ""}>
              Review due {formatDate(invoice.review_deadline, tz)}
            </div>
          )}
          {invoice.approved_at && <div>Approved {formatDate(invoice.approved_at, tz)}</div>}
          {invoice.paid_at && (
            <div>
              Paid {formatDate(invoice.paid_at, tz)}, marked by {invoice.marked_paid_by === "employee" ? "the employee" : "the CEO"}
            </div>
          )}
          {invoice.employee_reference && <div>Employee reference: {invoice.employee_reference}</div>}
        </dl>
      </div>

      <Card title="Lines">
        <InvoiceLines invoice={invoice} />
      </Card>

      {isApprover && invoice.status === "submitted" && (
        <Card title="Review">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-base text-ink-600">Approving tells the employee; pay it in Wise straight after.</p>
              <ActionButton
                action={approve.bind(null, invoice.id)}
                label={`Approve ${formatMoney(invoice.total_minor, currency)}`}
                pendingLabel="Approving…"
                variant="primary"
                confirmText={`Approve ${formatMoney(invoice.total_minor, currency)} for ${invoice.employee?.name ?? "this employee"}? They are told straight away.`}
              />
            </div>
            <div className="border-t border-ink-200 pt-4">
              <RejectForm action={reject.bind(null, invoice.id)} />
            </div>
          </div>
        </Card>
      )}

      {isApprover && invoice.status === "approved" && (
        <Card title="Paid in Wise?">
          <p className="mb-3 text-base text-ink-600">
            Optional: mark it paid to clear it from your daily summary. The employee can also mark it when the money arrives.
          </p>
          <ActionButton
            action={markPaid.bind(null, invoice.id)}
            label="Mark as paid"
            pendingLabel="Saving…"
            variant="primary"
            confirmText="Mark this invoice as paid? Only do this once the money has gone out in Wise."
          />
        </Card>
      )}

      {invoice.status === "paid" && (
        <Card title="Payment">
          {payment?.confirmed_by_accounts_at ? (
            <dl className="grid gap-x-6 gap-y-2 text-base sm:grid-cols-2">
              <div>
                <dt className="text-ink-600">Wise transfer</dt>
                <dd className="font-mono text-ink-900">{payment.wise_transfer_id}</dd>
              </div>
              <div>
                <dt className="text-ink-600">Confirmed by accounts</dt>
                <dd className="text-ink-900">{formatDate(payment.confirmed_by_accounts_at, tz)}</dd>
              </div>
              <div>
                <dt className="text-ink-600">Sent</dt>
                <dd className="text-ink-900">{money(payment.amount_sent_minor, payment.sent_currency)}</dd>
              </div>
              <div>
                <dt className="text-ink-600">Wise fee</dt>
                <dd className="text-ink-900">
                  {money(payment.wise_fee_minor, payment.sent_currency)} ·{" "}
                  {payment.fee_paid_by === "deducted" ? "deducted from payment" : "company paid"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-600">Received</dt>
                <dd className="text-ink-900">{money(payment.amount_received_minor, payment.received_currency)}</dd>
              </div>
              <div>
                <dt className="text-ink-600">Actual rate</dt>
                <dd className="text-ink-900">{payment.actual_exchange_rate ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-base text-ink-600">
              Not yet confirmed against Wise.
              {payment?.amount_received_minor != null &&
                ` The employee reported receiving ${money(payment.amount_received_minor, payment.received_currency)}.`}
            </p>
          )}

          {isAccounts && (
            <div className="mt-4 border-t border-ink-200 pt-4">
              <h3 className="mb-3 text-base font-medium text-ink-900">
                {payment?.confirmed_by_accounts_at ? "Update the Wise details" : "Confirm against Wise"}
              </h3>
              <ConfirmPaymentForm
                action={confirmPayment.bind(null, invoice.id)}
                invoiceCurrency={invoice.currency_code}
                currencies={currencies}
                defaultFeePaidBy={payment?.fee_paid_by ?? ((feeSetting?.value as "company" | "deducted" | "" | null) || null)}
                initial={{
                  transferId: payment?.wise_transfer_id ?? "",
                  sent: amount(payment?.amount_sent_minor ?? null, payment?.sent_currency ?? null),
                  sentCurrency: payment?.sent_currency ?? null,
                  fee: amount(payment?.wise_fee_minor ?? null, payment?.sent_currency ?? null),
                  received: amount(payment?.amount_received_minor ?? null, payment?.received_currency ?? invoice.currency_code),
                  receivedCurrency: payment?.received_currency ?? null,
                  rate: payment?.actual_exchange_rate?.toString() ?? "",
                }}
              />
            </div>
          )}
        </Card>
      )}

      <Card title="History">
        <ol className="flex flex-col gap-3">
          {[...invoice.events].reverse().map((e) => (
            <li key={e.id} className="text-base">
              <p className="text-ink-900">
                <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-ink-600">
                  {" "}
                  · {e.actor_id === viewer.id ? "You" : (e.actor?.name ?? "System")}
                </span>
              </p>
              {e.comment && <p className="text-ink-700">“{e.comment}”</p>}
              {e.system_note && (e.action.startsWith("attachment") || e.action === "payment_confirm") && (
                <p className="text-ink-600">{e.system_note}</p>
              )}
              <p className="text-sm text-ink-600">{formatDateTime(e.created_at, tz)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

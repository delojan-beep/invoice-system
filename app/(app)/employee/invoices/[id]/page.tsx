import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/src/auth/dal";
import { formatDate, formatDateTime, formatMonth } from "@/src/domain/format";
import { ACTION_LABELS, actorLabel } from "@/src/domain/history";
import { allowedActions, isEditable, isOverdue } from "@/src/domain/invoice";
import { getFormOptions, getInvoice, type InvoiceDetail } from "@/src/domain/invoice-queries";
import { formatMoney } from "@/src/domain/money";
import { ActionButton } from "@/src/ui/action-button";
import { Card, StatusBadge } from "@/src/ui/controls";
import {
  deleteLine,
  markPaid,
  recall,
  recordAttachment,
  removeAttachment,
  saveDetails,
  saveLine,
  submit,
} from "./actions";
import { DetailsForm, MarkPaidForm, SubmitForm } from "./forms";
import { LineForm } from "./line-form";
import { LineItem } from "./line-item";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function InvoicePage({ params }: PageProps<"/employee/invoices/[id]">) {
  const viewer = await requireAccess(["employee"]);
  const { id } = await params;

  const invoice = await getInvoice(id);
  if (!invoice || invoice.employee_id !== viewer.id || !invoice.currency) notFound();

  const options = await getFormOptions(invoice.currency_code);
  const currency = invoice.currency;
  const tz = viewer.timezone;
  const editable = isEditable(invoice.status);
  const actions = allowedActions({
    status: invoice.status,
    review_started_at: invoice.review_started_at,
    isOwner: true,
    isApprover: false,
  });
  const overdue = isOverdue(invoice);

  const lastRejection = [...invoice.events].reverse().find((e) => e.action === "reject");
  const lastPayment = invoice.payments.at(-1);
  const receivedCurrency = options.currencies.find((c) => c.code === lastPayment?.received_currency);
  const received =
    lastPayment?.amount_received_minor != null && receivedCurrency
      ? formatMoney(lastPayment.amount_received_minor, receivedCurrency)
      : null;

  // Tax shown by rate, e.g. "VAT 18%".
  const taxByRate = new Map<string, number>();
  for (const line of invoice.lines) {
    if (line.tax_rate && line.tax_minor > 0) {
      const key = `${line.tax_rate.label} ${line.tax_rate.percentage}%`;
      taxByRate.set(key, (taxByRate.get(key) ?? 0) + line.tax_minor);
    }
  }

  // What still blocks submission, in plain words.
  const blockers: string[] = [];
  if (invoice.lines.length === 0) blockers.push("Add at least one line");
  else if (invoice.total_minor <= 0) blockers.push("The total must be more than zero");
  for (const line of invoice.lines) {
    if (line.line_type?.receipt_required && line.attachments.length === 0) {
      blockers.push(`Attach a receipt for "${line.description}"`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/employee" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
          ← My invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-title font-medium text-ink-900">{formatMonth(invoice.month)}</h1>
            <StatusBadge status={invoice.status} overdue={overdue} />
          </div>
          <p className="text-amount font-medium text-brand-900">{formatMoney(invoice.total_minor, currency)}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-base text-ink-600">{invoice.number ?? "Number assigned when you submit"}</p>
          <a href={`/pdf/${invoice.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-base font-medium text-brand-700 hover:underline">Download PDF</a>
        </div>
      </div>

      <StatusNote invoice={invoice} tz={tz} rejection={lastRejection?.comment ?? null} received={received} />

      <Card title="Details">
        <DetailsForm
          action={saveDetails.bind(null, invoice.id)}
          editable={editable}
          currency={invoice.currency_code}
          currencies={options.currencies}
          reference={invoice.employee_reference ?? ""}
        />
      </Card>

      <Card title="Lines">
        {invoice.lines.length === 0 ? (
          <p className="text-base text-ink-600">No lines yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {invoice.lines.map((line) => (
              <LineItem
                key={line.id}
                line={line}
                currency={currency}
                editable={editable}
                employeeId={viewer.id}
                invoiceId={invoice.id}
                lineTypes={options.lineTypes}
                taxRates={options.taxRates}
                saveLine={saveLine.bind(null, invoice.id, invoice.currency_code, line.id)}
                deleteLine={deleteLine.bind(null, invoice.id, line.id)}
                recordAttachment={recordAttachment.bind(null, line.id)}
                removeAttachment={Object.fromEntries(
                  line.attachments.map((a) => [a.id, removeAttachment.bind(null, a.id)]),
                )}
              />
            ))}
          </ul>
        )}

        <dl className="mt-4 flex flex-col gap-1 border-t border-ink-200 pt-4 text-base">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd className="text-ink-900">{formatMoney(invoice.subtotal_minor, currency)}</dd>
          </div>
          {[...taxByRate].map(([label, amount]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-ink-600">{label}</dt>
              <dd className="text-ink-900">{formatMoney(amount, currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-lg font-medium">
            <dt className="text-ink-900">Total</dt>
            <dd className="text-ink-900">{formatMoney(invoice.total_minor, currency)}</dd>
          </div>
        </dl>

        {editable && (
          <div className="mt-6 border-t border-ink-200 pt-4">
            <h3 className="mb-3 text-base font-medium text-ink-900">Add a line</h3>
            <LineForm
              action={saveLine.bind(null, invoice.id, invoice.currency_code, null)}
              currency={currency}
              lineTypes={options.lineTypes}
              taxRates={options.taxRates}
              submitLabel="Add line"
            />
          </div>
        )}
      </Card>

      {actions.includes("submit") && (
        <Card title={invoice.status === "rejected" ? "Fix and resubmit" : "Submit"}>
          <p className="mb-3 text-base text-ink-600">
            Check every line and the total. Nothing goes to the CEO until you confirm and submit.
          </p>
          <SubmitForm
            action={submit.bind(null, invoice.id)}
            blockers={blockers}
            resubmit={invoice.status === "rejected" || invoice.recalled_at !== null}
          />
        </Card>
      )}

      {actions.includes("recall") && (
        <Card title="Need to change something?">
          <p className="mb-3 text-base text-ink-600">
            You can pull it back to draft until the CEO opens it. The review period restarts when you resubmit.
          </p>
          <ActionButton
            action={recall.bind(null, invoice.id)}
            label="Recall to draft"
            pendingLabel="Recalling…"
            confirmText="Recall this invoice to draft?"
          />
        </Card>
      )}

      {actions.includes("mark_paid") && (
        <Card title="Money arrived?">
          <p className="mb-3 text-base text-ink-600">Mark it paid once the money reaches your account.</p>
          <MarkPaidForm
            action={markPaid.bind(null, invoice.id, invoice.currency_code)}
            currency={currency}
            currencies={options.currencies}
          />
        </Card>
      )}

      <Card title="History">
        <ol className="flex flex-col gap-3">
          {[...invoice.events].reverse().map((e) => (
            <li key={e.id} className="text-base">
              <p className="text-ink-900">
                <span className="font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-ink-600"> · {actorLabel(e.actor_id, viewer.id, invoice.employee_id)}</span>
              </p>
              {e.comment && <p className="text-ink-700">“{e.comment}”</p>}
              {e.system_note && e.action.startsWith("line") && (
                // The note reads "<description>: <qty> x <rate> = <amount>" in minor units; show the description.
                <p className="text-ink-600">{e.system_note.slice(0, e.system_note.lastIndexOf(": "))}</p>
              )}
              {e.system_note && e.action.startsWith("attachment") && <p className="text-ink-600">{e.system_note}</p>}
              <p className="text-sm text-ink-600">{formatDateTime(e.created_at, tz)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function StatusNote({
  invoice,
  tz,
  rejection,
  received,
}: {
  invoice: InvoiceDetail;
  tz: string;
  rejection: string | null;
  received: string | null;
}) {
  const box = "rounded-xl border px-4 py-3 text-base";
  switch (invoice.status) {
    case "draft":
      return (
        <p className={`${box} border-ink-200 bg-white text-ink-700`}>
          Add your lines during the month, then submit whenever suits you.
        </p>
      );
    case "rejected":
      return (
        <div className={`${box} border-amber-200 bg-amber-50 text-amber-900`}>
          <p className="font-medium">The CEO sent this back</p>
          {rejection && <p className="mt-1">“{rejection}”</p>}
          <p className="mt-1">Fix it and resubmit. The review period restarts from the resubmission date.</p>
        </div>
      );
    case "submitted":
      return (
        <p className={`${box} border-brand-200 bg-brand-50 text-brand-900`}>
          {invoice.review_started_at
            ? "The CEO is reviewing it."
            : "Waiting for the CEO to review."}{" "}
          {invoice.review_deadline && `Review due by ${formatDate(invoice.review_deadline, tz)}.`}
        </p>
      );
    case "approved":
      return (
        <p className={`${box} border-emerald-200 bg-emerald-50 text-emerald-900`}>
          Approved{invoice.approved_at && ` on ${formatDate(invoice.approved_at, tz)}`}. Payment follows through Wise.
        </p>
      );
    case "paid":
      return (
        <p className={`${box} border-emerald-200 bg-emerald-50 text-emerald-900`}>
          Paid{invoice.paid_at && ` on ${formatDate(invoice.paid_at, tz)}`}, marked by{" "}
          {invoice.marked_paid_by === "employee" ? "you" : "the CEO"}.{received && ` Received ${received}.`}
        </p>
      );
  }
}

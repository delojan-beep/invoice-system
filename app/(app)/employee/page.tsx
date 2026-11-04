import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";
import { formatDate, formatMonth } from "@/src/domain/format";
import { isOverdue } from "@/src/domain/invoice";
import { ensureMonthlyDraft } from "@/src/domain/invoice-actions";
import { listMyInvoices } from "@/src/domain/invoice-queries";
import { formatMoney } from "@/src/domain/money";
import { Card, StatusBadge } from "@/src/ui/controls";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function EmployeePage() {
  const viewer = await requireAccess(["employee"]);

  // This month's draft exists from the first visit (the monthly job also creates it).
  const draft = await ensureMonthlyDraft();
  const invoices = await listMyInvoices(viewer.id);
  const current = draft.ok ? invoices.find((i) => i.id === draft.data) : undefined;
  const needsAction = invoices.filter((i) => i.status === "rejected" || i.status === "approved");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-title font-medium text-ink-900">My invoices</h1>

      {!draft.ok && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900">
          This month&apos;s invoice could not be opened: {draft.error}
        </p>
      )}

      {needsAction.map((i) => (
        <Link
          key={i.id}
          href={`/employee/invoices/${i.id}`}
          className={`rounded-xl border px-4 py-3 text-base hover:underline ${
            i.status === "rejected"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {i.status === "rejected"
            ? `${formatMonth(i.month)} was sent back by the CEO. Fix and resubmit →`
            : `${formatMonth(i.month)} is approved. Mark it paid when the money arrives →`}
        </Link>
      ))}

      {current && current.currency && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-ink-600">
                This month · {formatMonth(current.month)}
              </h2>
              <p className="mt-2 text-amount font-medium text-brand-900">
                {formatMoney(current.total_minor, current.currency)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusBadge status={current.status} overdue={isOverdue(current)} />
                {(current.paid_at || current.submitted_at) && (
                  <span className="text-sm text-ink-600">
                    {current.paid_at
                      ? formatDate(current.paid_at, viewer.timezone)
                      : `Submitted ${formatDate(current.submitted_at!, viewer.timezone)}`}
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/employee/invoices/${current.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-base font-medium text-white transition-colors duration-150 hover:bg-brand-800"
            >
              {current.status === "draft" || current.status === "rejected" ? "Open and edit" : "View invoice"}
            </Link>
          </div>
        </Card>
      )}

      <Card title="All invoices">
        {invoices.length === 0 ? (
          <p className="text-base text-ink-600">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {invoices.map((i) => (
              <li key={i.id}>
                {/* Phones: month and amount on one line, status under them. Wider: three columns. */}
                <Link
                  href={`/employee/invoices/${i.id}`}
                  className="-mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-ink-50 sm:-mx-6 sm:grid-cols-[minmax(0,1fr)_8rem_9rem] sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{formatMonth(i.month)}</p>
                    <p className="text-sm text-ink-600">
                      {i.number ?? "Not submitted yet"}
                      {i.submitted_at && ` · Submitted ${formatDate(i.submitted_at, viewer.timezone)}`}
                    </p>
                  </div>
                  <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <StatusBadge status={i.status} overdue={isOverdue(i)} />
                  </div>
                  <span className="text-right text-base font-medium text-ink-900">
                    {i.currency ? formatMoney(i.total_minor, i.currency) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">My invoices</h1>

      {!draft.ok && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This month&apos;s invoice could not be opened: {draft.error}
        </p>
      )}

      {needsAction.map((i) => (
        <Link
          key={i.id}
          href={`/employee/invoices/${i.id}`}
          className={`rounded-xl border px-4 py-3 text-sm hover:underline ${
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
        <Card title={`This month: ${formatMonth(current.month)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={current.status} overdue={isOverdue(current)} />
              <span className="text-lg font-semibold text-zinc-900">
                {formatMoney(current.total_minor, current.currency)}
              </span>
            </div>
            <Link
              href={`/employee/invoices/${current.id}`}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              {current.status === "draft" || current.status === "rejected" ? "Open and edit" : "View"}
            </Link>
          </div>
        </Card>
      )}

      <Card title="All invoices">
        {invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/employee/invoices/${i.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{formatMonth(i.month)}</p>
                    <p className="font-mono text-xs text-zinc-500">{i.number ?? "Not submitted yet"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {i.submitted_at && (
                      <span className="hidden text-xs text-zinc-500 sm:inline">
                        Submitted {formatDate(i.submitted_at, viewer.timezone)}
                      </span>
                    )}
                    <StatusBadge status={i.status} overdue={isOverdue(i)} />
                    <span className="w-36 text-right text-sm font-medium text-zinc-900">
                      {i.currency ? formatMoney(i.total_minor, i.currency) : ""}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

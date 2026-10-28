import { requireAccess } from "@/src/auth/dal";
import { formatDate, formatMonth } from "@/src/domain/format";
import { formatMoney } from "@/src/domain/money";
import { getApproverQueue, type StaffInvoice } from "@/src/domain/staff-queries";
import { Card } from "@/src/ui/controls";
import { approveSelected, markSelectedPaid } from "../invoices/actions";
import { QueueTable, type QueueRow } from "./queue-table";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function ApproverPage() {
  const viewer = await requireAccess(["approver"]);
  const { overdue, waiting, toPay } = await getApproverQueue();
  const tz = viewer.timezone;

  const row = (i: StaffInvoice, when: string, urgent = false): QueueRow => ({
    id: i.id,
    employee: i.employee?.name ?? "Unknown",
    month: formatMonth(i.month),
    number: i.number ?? "",
    total: i.currency ? formatMoney(i.total_minor, i.currency) : "",
    when,
    urgent,
  });

  const toReview = [
    ...overdue.map((i) => row(i, `Overdue since ${formatDate(i.review_deadline!, tz)}`, true)),
    ...waiting.map((i) => row(i, `Due ${formatDate(i.review_deadline!, tz)}`)),
  ];
  const paying = toPay.map((i) => row(i, `Approved ${formatDate(i.approved_at!, tz)}`));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Approvals</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {toReview.length === 0 && paying.length === 0
            ? "Nothing waiting. Every invoice is paid."
            : `${toReview.length} to review${overdue.length ? ` (${overdue.length} overdue)` : ""}, ${paying.length} approved and waiting for payment.`}
        </p>
      </div>

      {toReview.length > 0 && (
        <Card title="Waiting for approval">
          <QueueTable
            rows={toReview}
            action={approveSelected}
            label="Approve selected"
            pendingLabel="Approving…"
          />
        </Card>
      )}

      {paying.length > 0 && (
        <Card title="Approved, waiting for payment">
          <p className="mb-3 text-sm text-zinc-600">
            Pay these in Wise. Marking them paid here is optional; employees can mark their own when the money arrives.
          </p>
          <QueueTable
            rows={paying}
            action={markSelectedPaid}
            label="Mark selected paid"
            pendingLabel="Saving…"
          />
        </Card>
      )}
    </div>
  );
}

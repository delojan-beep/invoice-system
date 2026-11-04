import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";
import { formatMonth } from "@/src/domain/format";
import { isOverdue } from "@/src/domain/invoice";
import { formatMoney } from "@/src/domain/money";
import { listCurrencies, listEmployees, listInvoiceMonths, listInvoices } from "@/src/domain/staff-queries";
import { Card, StatusBadge } from "@/src/ui/controls";
import { filtersToQuery, parseFilters } from "./filters";
import { FiltersForm } from "./filters-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await requireAccess(["accounts"]);
  const filters = parseFilters(await searchParams);
  const [invoices, unconfirmed, employees, currencies, months] = await Promise.all([
    listInvoices(filters),
    listInvoices({ status: "unconfirmed" }),
    listEmployees(),
    listCurrencies(),
    listInvoiceMonths(),
  ]);

  // Totals per currency: amounts are never converted silently.
  const totals = new Map<string, number>();
  for (const i of invoices) totals.set(i.currency!.code, (totals.get(i.currency!.code) ?? 0) + i.total_minor);

  if (filters.month && !months.includes(filters.month)) months.unshift(filters.month);
  const query = filtersToQuery(filters);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-title font-medium text-ink-900">All invoices</h1>
        <a
          href={`/accounts/export${query ? `?${query}` : ""}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-400 bg-surface px-4 py-2 text-base font-medium text-ink-800 hover:bg-ink-50"
        >
          Export CSV
        </a>
      </div>

      {unconfirmed.length > 0 && filters.status !== "unconfirmed" && (
        <Link
          href="/accounts?status=unconfirmed"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900 hover:underline"
        >
          {unconfirmed.length} paid invoice{unconfirmed.length === 1 ? "" : "s"} still need{unconfirmed.length === 1 ? "s" : ""} confirming against Wise →
        </Link>
      )}

      <FiltersForm
        filters={filters}
        employees={employees}
        months={months.map((m) => ({ value: m, label: formatMonth(m) }))}
        currencies={currencies.map((c) => c.code)}
      />

      <Card
        title={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
        actions={
          <p className="text-base text-ink-600">
            {[...totals]
              .map(([code, total]) => formatMoney(total, currencies.find((c) => c.code === code)!))
              .join(" · ")}
          </p>
        }
      >
        {invoices.length === 0 ? (
          <p className="text-base text-ink-600">No invoices match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            {/* Below 1024 px, where the table won't fit its card, each invoice stacks as name and total, then number, status and payment. Wider: a table. */}
            <table className="w-full text-left text-base max-lg:block lg:min-w-[720px]">
              <thead className="border-b border-ink-200 text-sm uppercase tracking-wide text-ink-600 max-lg:hidden">
                <tr>
                  <th className="px-4 py-2 font-medium lg:pl-0">Employee</th>
                  <th className="px-2 py-2 font-medium">Invoice</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 font-medium lg:pr-0">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 max-lg:block">
                {invoices.map((i) => {
                  const payment = i.payments.at(-1);
                  return (
                    <tr key={i.id} className="align-middle max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:gap-x-4 max-lg:gap-y-1 max-lg:py-3 sm:max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <td className="px-4 py-3 max-lg:p-0 sm:max-lg:row-span-2 lg:pl-0">
                        <Link href={`/invoices/${i.id}?from=accounts`} className="inline-flex min-h-11 items-center font-medium lg:-mb-2 lg:whitespace-nowrap text-brand-700 hover:underline">
                          {i.employee?.name}
                        </Link>
                        <div className="text-sm text-ink-600">{formatMonth(i.month)}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-ink-700 max-lg:col-span-2 max-lg:p-0 sm:max-lg:col-span-1 sm:max-lg:col-start-2 sm:max-lg:row-start-1 sm:max-lg:pt-3">{i.number}</td>
                      <td className="px-2 py-3 max-lg:col-span-2 max-lg:p-0 sm:max-lg:col-span-1 sm:max-lg:col-start-2 sm:max-lg:row-start-2">
                        <StatusBadge status={i.status} overdue={isOverdue(i)} />
                      </td>
                      <td className="px-2 py-3 text-right font-medium text-ink-900 max-lg:col-start-2 max-lg:row-start-1 max-lg:p-0 max-lg:pt-2.5 sm:max-lg:col-start-3">
                        {formatMoney(i.total_minor, i.currency!)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-ink-600 max-lg:col-span-2 max-lg:p-0 sm:max-lg:col-start-2 sm:max-lg:row-start-3 lg:pr-0 ${i.status === "paid" ? "" : "max-lg:hidden"}`}>
                        {i.status !== "paid"
                          ? "—"
                          : `Marked by ${i.marked_paid_by === "employee" ? "employee" : "CEO"} · ${
                              payment?.confirmed_by_accounts_at ? "confirmed" : "not confirmed"
                            }`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";
import { formatMonth } from "@/src/domain/format";
import { isOverdue } from "@/src/domain/invoice";
import { formatMoney } from "@/src/domain/money";
import { listCurrencies, listEmployees, listInvoices } from "@/src/domain/staff-queries";
import { Card, StatusBadge } from "@/src/ui/controls";
import { filtersToQuery, parseFilters } from "./filters";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const SELECT =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-blue-600 focus:outline-none sm:text-sm";

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await requireAccess(["accounts"]);
  const filters = parseFilters(await searchParams);
  const [invoices, employees, currencies] = await Promise.all([listInvoices(filters), listEmployees(), listCurrencies()]);

  // Totals per currency: amounts are never converted silently.
  const totals = new Map<string, number>();
  for (const i of invoices) totals.set(i.currency!.code, (totals.get(i.currency!.code) ?? 0) + i.total_minor);

  const months = [...new Set(invoices.map((i) => i.month.slice(0, 7)))];
  if (filters.month && !months.includes(filters.month)) months.unshift(filters.month);
  const query = filtersToQuery(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">All invoices</h1>
        <a
          href={`/accounts/export${query ? `?${query}` : ""}`}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Employee
          <select name="employee" defaultValue={filters.employee ?? ""} className={SELECT}>
            <option value="">Everyone</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.employee_code ? ` (${e.employee_code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Month
          <input type="month" name="month" defaultValue={filters.month ?? ""} className={SELECT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Currency
          <select name="currency" defaultValue={filters.currency ?? ""} className={SELECT}>
            <option value="">All</option>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className={SELECT}>
            <option value="">Any</option>
            <option value="submitted">Submitted</option>
            <option value="overdue">Overdue</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
            <option value="unconfirmed">Paid, not confirmed</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          Filter
        </button>
        {query && (
          <Link href="/accounts" className="py-2 text-sm text-blue-700 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <Card
        title={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
        actions={
          <p className="text-sm text-zinc-600">
            {[...totals]
              .map(([code, total]) => formatMoney(total, currencies.find((c) => c.code === code)!))
              .join(" · ")}
          </p>
        }
      >
        {invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices match these filters.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:pl-0">Employee</th>
                  <th className="px-2 py-2 font-medium">Invoice</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 font-medium sm:pr-0">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map((i) => {
                  const payment = i.payments.at(-1);
                  return (
                    <tr key={i.id} className="align-top">
                      <td className="px-4 py-3 sm:pl-0">
                        <Link href={`/invoices/${i.id}?from=accounts`} className="font-medium text-blue-700 hover:underline">
                          {i.employee?.name}
                        </Link>
                        <div className="text-xs text-zinc-500">{formatMonth(i.month)}</div>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-zinc-700">{i.number}</td>
                      <td className="px-2 py-3">
                        <StatusBadge status={i.status} overdue={isOverdue(i)} />
                      </td>
                      <td className="px-2 py-3 text-right font-medium text-zinc-900">
                        {formatMoney(i.total_minor, i.currency!)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 sm:pr-0">
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

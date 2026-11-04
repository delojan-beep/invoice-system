"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import type { InvoiceFilters } from "@/src/domain/staff-queries";
import { Label, Select } from "@/src/ui/controls";
import { filtersToQuery } from "./filters";

/**
 * Filters apply as soon as a field changes. The form stays in place while the list
 * updates, so keyboard users keep their focus and can move on to the next field.
 */
export function FiltersForm({
  filters,
  employees,
  months,
  currencies,
}: {
  filters: InvoiceFilters;
  employees: { id: string; name: string; employee_code: string | null }[];
  months: { value: string; label: string }[];
  currencies: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const query = filtersToQuery(filters);

  // Follow the address when a link changes it (the banner above, or Clear).
  const [values, setValues] = useState(filters);
  const [shownQuery, setShownQuery] = useState(query);
  if (query !== shownQuery) {
    setShownQuery(query);
    setValues(filters);
  }

  const change = (key: keyof InvoiceFilters) => (event: ChangeEvent<HTMLSelectElement>) => {
    const next = { ...values, [key]: event.target.value || undefined } as InvoiceFilters;
    setValues(next);
    const nextQuery = filtersToQuery(next);
    startTransition(() => router.replace(nextQuery ? `/accounts?${nextQuery}` : "/accounts", { scroll: false }));
  };

  return (
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-200 bg-surface p-4">
      <Label text="Employee">
        <Select name="employee" value={values.employee ?? ""} onChange={change("employee")}>
          <option value="">Everyone</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.employee_code ? ` (${e.employee_code})` : ""}
            </option>
          ))}
        </Select>
      </Label>
      <Label text="Month">
        <Select name="month" value={values.month ?? ""} onChange={change("month")}>
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>
      <Label text="Currency">
        <Select name="currency" value={values.currency ?? ""} onChange={change("currency")}>
          <option value="">All</option>
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </Label>
      <Label text="Status">
        <Select name="status" value={values.status ?? ""} onChange={change("status")}>
          <option value="">Any</option>
          <option value="submitted">Submitted</option>
          <option value="overdue">Overdue</option>
          <option value="approved">Approved</option>
          <option value="rejected">Sent back</option>
          <option value="paid">Paid</option>
          <option value="unconfirmed">Paid, not confirmed</option>
        </Select>
      </Label>
      {/* Only needed if the page's scripts haven't loaded. */}
      <noscript>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-base font-medium text-on-brand hover:bg-brand-800"
        >
          Filter
        </button>
      </noscript>
      {query && (
        <Link href="/accounts" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
          Clear
        </Link>
      )}
      <span role="status" className="inline-flex min-h-11 items-center text-sm text-ink-600">
        {pending ? "Updating…" : ""}
      </span>
    </form>
  );
}

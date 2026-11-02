"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormAction } from "@/src/ui/use-form-action";
import { Btn, Message } from "@/src/ui/controls";
import type { FormState } from "../invoices/actions";

export type QueueRow = {
  id: string;
  employee: string;
  month: string; // "October 2026"
  number: string;
  total: string; // formatted
  when: string; // e.g. "Due Nov 7" or "Approved Oct 28"
  urgent: boolean;
};

/** A list of invoices with tick boxes and one bulk action for the ticked ones. */
export function QueueTable({
  rows,
  action,
  label,
  pendingLabel,
}: {
  rows: QueueRow[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string; // shown with the ticked count: "Approve selected (3)"
  pendingLabel: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, run, pending] = useFormAction(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) setSelected(new Set());
    return result;
  }, {});

  const allTicked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form onSubmit={run} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allTicked}
            onChange={() => setSelected(allTicked ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          Select all
        </label>
        <Btn type="submit" disabled={pending || selected.size === 0}>
          {pending ? pendingLabel : selected.size ? `${label} (${selected.size})` : label}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>

      <ul className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <input
              type="checkbox"
              name="ids"
              value={r.id}
              aria-label={`Select ${r.employee}, ${r.month}`}
              className="h-4 w-4 shrink-0"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <Link href={`/invoices/${r.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 hover:underline">
              <span className="min-w-0">
                <span className="block font-medium text-zinc-900">
                  {r.employee} · {r.month}
                </span>
                <span className="block font-mono text-xs text-zinc-500">{r.number}</span>
              </span>
              <span className="text-right">
                <span className="block font-medium text-zinc-900">{r.total}</span>
                <span className={`block text-xs ${r.urgent ? "font-medium text-red-700" : "text-zinc-500"}`}>{r.when}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatMoney, type CurrencyInfo } from "@/src/domain/money";
import { useConfirmedSubmit } from "@/src/ui/confirm-dialog";
import { useFormAction } from "@/src/ui/use-form-action";
import { Btn, Card, Message } from "@/src/ui/controls";
import type { FormState } from "../invoices/actions";

export type QueueRow = {
  id: string;
  employee: string;
  month: string; // "October 2026"
  number: string;
  total: string; // formatted
  totalMinor: number;
  currency: CurrencyInfo | null;
  when: string; // e.g. "Due Nov 7" or "Approved Oct 28"
  urgent: boolean;
};

/**
 * A titled list of invoices with tick boxes and one bulk action for the ticked ones.
 * It stays mounted when the list is empty, so the result of emptying it can still be read.
 */
export function QueueTable({
  title,
  intro,
  rows,
  action,
  label,
  pendingLabel,
  confirmQuestion,
}: {
  title: string;
  intro?: ReactNode;
  rows: QueueRow[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string; // shown with the ticked count: "Approve selected (3)"
  pendingLabel: string;
  confirmQuestion: string; // {n} becomes the ticked count: "Approve {n}?" reads "Approve 3 invoices?"
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { guard, dialog } = useConfirmedSubmit();
  const [state, run, pending] = useFormAction(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) setSelected(new Set());
    return result;
  }, {});

  // A bulk money action: ask once, naming who and how much. Totals stay per currency, never converted.
  const confirmBulk = (e: FormEvent<HTMLFormElement>) => {
    const picked = rows.filter((r) => selected.has(r.id));
    const n = picked.length;
    // A non-breaking space keeps each symbol on the same line as its amount.
    const keepTogether = (money: string) => money.replace(" ", " ");
    const shown = picked.slice(0, 12).map((r) => `${r.employee}, ${r.month}: ${keepTogether(r.total)}`);
    if (n > shown.length) shown.push(`and ${n - shown.length} more`);

    const totals = new Map<string, { minor: number; currency: CurrencyInfo }>();
    for (const r of picked) {
      if (!r.currency) continue;
      const sum = totals.get(r.currency.code)?.minor ?? 0;
      totals.set(r.currency.code, { minor: sum + r.totalMinor, currency: r.currency });
    }
    const total = [...totals.values()].map((t) => keepTogether(formatMoney(t.minor, t.currency))).join(" + ");

    const question = confirmQuestion.replace("{n}", `${n} invoice${n === 1 ? "" : "s"}`);
    const summary = n > 1 ? `\n\nTotal: ${total}` : "";
    if (!guard(e, { message: `${question}\n\n${shown.join("\n")}${summary}`, confirmLabel: label })) return;
    run(e);
  };

  const allTicked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) return state.message || state.error ? <Message error={state.error} message={state.message} /> : null;

  return (
    <Card title={title}>
      {intro}
      <form onSubmit={confirmBulk} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink-700">
          <input
            type="checkbox"
            className="size-5"
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

      <ul className="divide-y divide-ink-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-1 py-3">
            {/* The whole 44px square toggles the 20px box. */}
            <label className="-my-1 flex size-11 shrink-0 cursor-pointer items-center justify-start">
              <input
                type="checkbox"
                name="ids"
                value={r.id}
                aria-label={`Select ${r.employee}, ${r.month}`}
                className="size-5"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
              />
            </label>
            <Link href={`/invoices/${r.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 hover:underline">
              <span className="min-w-0">
                <span className="block font-medium text-ink-900">
                  {r.employee} · {r.month}
                </span>
                <span className="block text-sm text-ink-600">{r.number}</span>
              </span>
              <span className="sm:text-right">
                <span className="block font-medium text-ink-900">{r.total}</span>
                <span className={`block text-sm ${r.urgent ? "font-medium text-red-700" : "text-ink-600"}`}>{r.when}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
        {dialog}
      </form>
    </Card>
  );
}

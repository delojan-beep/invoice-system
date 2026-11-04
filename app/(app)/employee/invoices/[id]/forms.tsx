"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import { useState } from "react";
import { useConfirmedSubmit } from "@/src/ui/confirm-dialog";
import { useFormAction } from "@/src/ui/use-form-action";
import { formatMoney, type CurrencyInfo } from "@/src/domain/money";
import { Btn, Input, Label, Message, Select } from "@/src/ui/controls";
import type { FormState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Currency (while editable) and "My reference" (always). */
export function DetailsForm({
  action,
  editable,
  currency,
  currencies,
  reference,
  hasLines,
  subtotalMinor,
}: {
  action: Action;
  editable: boolean;
  currency: string;
  currencies: CurrencyInfo[];
  reference: string;
  hasLines: boolean;
  subtotalMinor: number;
}) {
  const [state, run, pending] = useFormAction(action, {});
  const [selected, setSelected] = useState(currency);
  const { guard, dialog } = useConfirmedSubmit();

  // Lines store plain numbers, so a new currency relabels them instead of converting them.
  const next = currencies.find((c) => c.code === selected);
  const relabel =
    hasLines && next && selected !== currency
      ? `Amounts aren't converted, so the subtotal becomes ${formatMoney(subtotalMinor, next)}. Any tax rates are removed.`
      : null;

  return (
    <CheckedForm
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        const message = `Change this invoice from ${currency} to ${selected}?\n\n${relabel}`;
        if (relabel && !guard(e, { message, confirmLabel: "Change currency" })) return;
        run(e);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {editable && (
          <Label text="Currency" hint={relabel ? undefined : "Amounts aren't converted when you change it. Any tax rates are removed."}>
            <Select name="currency" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </Label>
        )}
        <Label text="My reference" hint="Optional note for your own records">
          <Input name="reference" defaultValue={reference} maxLength={200} />
        </Label>
      </div>
      {relabel && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900">
          {relabel} Check every line before you submit.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Btn type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
      {dialog}
    </CheckedForm>
  );
}

/** Confirmation tick and submit. Shows what still blocks submission. */
export function SubmitForm({
  action,
  blockers,
  resubmit,
}: {
  action: Action;
  blockers: string[];
  resubmit: boolean;
}) {
  const [state, run, pending] = useFormAction(action, {});
  const [confirmed, setConfirmed] = useState(false);
  const [problem, setProblem] = useState<string>();
  const blocked = blockers.length > 0;

  return (
    <CheckedForm
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        // The button stays enabled so it can say what's missing, instead of just not responding.
        if (blocked || !confirmed) {
          e.preventDefault();
          setProblem(blocked ? "Fix the items above before you submit." : "Tick the box to confirm everything is correct.");
          if (!blocked) e.currentTarget.querySelector<HTMLInputElement>('input[name="confirmed"]')?.focus();
          return;
        }
        setProblem(undefined);
        run(e);
      }}
    >
      {blocked && (
        <ul className="list-disc pl-5 text-base text-amber-800">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <label className="flex min-h-11 items-start gap-3 py-2 text-base text-ink-800">
        <input
          type="checkbox"
          name="confirmed"
          className="mt-0.5 size-5 shrink-0"
          checked={confirmed}
          onChange={(e) => {
            setConfirmed(e.target.checked);
            setProblem(undefined);
          }}
        />
        I confirm everything is correct
      </label>
      <Message error={problem} />
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Submitting…" : resubmit ? "Resubmit invoice" : "Submit invoice"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </CheckedForm>
  );
}

/** Mark an approved invoice paid, optionally with the amount received. */
export function MarkPaidForm({
  action,
  currency,
  currencies,
}: {
  action: Action;
  currency: CurrencyInfo;
  currencies: CurrencyInfo[];
}) {
  const [state, run, pending] = useFormAction(action, {});
  const { guard, dialog } = useConfirmedSubmit();
  return (
    <CheckedForm
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        const message = "Mark this invoice as paid? Only do this once the money has arrived.";
        if (!guard(e, { message, confirmLabel: "Mark as paid" })) return;
        run(e);
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Label text="Amount received" hint="Optional">
          <Input name="amount" inputMode="decimal" placeholder="0.00" />
        </Label>
        <Label text="Currency">
          <Select name="receivedCurrency" defaultValue={currency.code}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </Label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : "Mark as paid"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
      {dialog}
    </CheckedForm>
  );
}

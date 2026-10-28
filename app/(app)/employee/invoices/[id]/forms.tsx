"use client";

import { useState } from "react";
import { useFormAction } from "@/src/ui/use-form-action";
import type { CurrencyInfo } from "@/src/domain/money";
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
}: {
  action: Action;
  editable: boolean;
  currency: string;
  currencies: CurrencyInfo[];
  reference: string;
}) {
  const [state, run, pending] = useFormAction(action, {});
  return (
    <form onSubmit={run} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {editable && (
          <Label text="Currency" hint="Changing it removes tax rates set for the old currency">
            <Select name="currency" defaultValue={currency}>
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
      <div className="flex items-center gap-3">
        <Btn type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </form>
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
  const blocked = blockers.length > 0;

  return (
    <form onSubmit={run} className="flex flex-col gap-3">
      {blocked && (
        <ul className="list-disc pl-5 text-sm text-amber-800">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          name="confirmed"
          className="mt-0.5 h-4 w-4"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm everything is correct
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending || !confirmed || blocked}>
          {pending ? "Submitting…" : resubmit ? "Resubmit invoice" : "Submit invoice"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </form>
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
  return (
    <form onSubmit={run} className="flex flex-col gap-3">
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
    </form>
  );
}

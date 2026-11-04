"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import type { ReactNode } from "react";
import { Btn, Input, Label, Message, Select } from "@/src/ui/controls";
import { useFormAction } from "@/src/ui/use-form-action";
import type { FormState } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** A small "add" form with its own error/success line. */
export function AddForm({ action, children, label }: { action: Action; children: ReactNode; label: string }) {
  const [state, run, pending] = useFormAction(action);
  return (
    <CheckedForm onSubmit={run} className="flex flex-col gap-3 border-t border-zinc-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-4">{children}</div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : label}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </CheckedForm>
  );
}

export function CurrencyFields() {
  return (
    <>
      <Label text="Code">
        <Input name="code" maxLength={3} placeholder="USD" className="uppercase" required />
      </Label>
      <Label text="Name">
        <Input name="name" placeholder="US dollar" required />
      </Label>
      <Label text="Symbol">
        <Input name="symbol" maxLength={5} placeholder="$" required />
      </Label>
      <Label text="Decimal places">
        <Input name="decimalPlaces" type="number" min={0} max={4} defaultValue={2} required />
      </Label>
    </>
  );
}

export function TaxFields({ currencies }: { currencies: string[] }) {
  return (
    <>
      <Label text="Name">
        <Input name="name" placeholder="VAT 18%" required />
      </Label>
      <Label text="Percent">
        <Input name="percentage" type="number" min={0} max={100} step="0.001" required />
      </Label>
      <Label text="Label on invoices">
        <Input name="label" placeholder="VAT" required />
      </Label>
      <Label text="Currency">
        <Select name="currency" required>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Label>
    </>
  );
}

export function LineTypeFields() {
  return (
    <>
      <Label text="Name">
        <Input name="name" placeholder="Training" required />
      </Label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-800">
        <input type="checkbox" name="receiptRequired" className="h-4 w-4" />
        Receipt required
      </label>
    </>
  );
}

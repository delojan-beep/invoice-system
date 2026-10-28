"use client";

import { useActionState, useRef, useState } from "react";
import { lineAmounts } from "@/src/domain/invoice";
import { formatMoney, parseAmount, type CurrencyInfo } from "@/src/domain/money";
import { Btn, Input, Label, Message, Select } from "@/src/ui/controls";
import type { FormState } from "./actions";

type Option = { id: string; name: string };

export type LineFormValues = {
  lineTypeId: string;
  description: string;
  quantity: string;
  rate: string;
  taxRateId: string;
};

const EMPTY: LineFormValues = { lineTypeId: "", description: "", quantity: "1", rate: "", taxRateId: "" };

export function LineForm({
  action,
  currency,
  lineTypes,
  taxRates,
  initial,
  submitLabel,
  onDone,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  currency: CurrencyInfo;
  lineTypes: (Option & { receipt_required: boolean })[];
  taxRates: (Option & { percentage: number; label: string })[];
  initial?: LineFormValues;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [values, setValues] = useState<LineFormValues>(initial ?? EMPTY);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, run, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      if (!initial) setValues(EMPTY);
      onDone?.();
    }
    return result;
  }, {});

  const set = (key: keyof LineFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  // Live preview with the same maths the database uses.
  const quantity = Number(values.quantity);
  const rateMinor = parseAmount(values.rate, currency.decimal_places);
  const taxRate = taxRates.find((t) => t.id === values.taxRateId);
  const preview =
    quantity > 0 && rateMinor !== null ? lineAmounts(quantity, rateMinor, taxRate ? taxRate.percentage : null) : null;
  const needsReceipt = lineTypes.find((t) => t.id === values.lineTypeId)?.receipt_required;

  return (
    <form ref={formRef} action={run} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Type" hint={needsReceipt ? "Needs a receipt before you submit" : undefined}>
          <Select name="lineTypeId" value={values.lineTypeId} onChange={set("lineTypeId")} required>
            <option value="" disabled>
              Choose…
            </option>
            {lineTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Label>
        <Label text="Description">
          <Input name="description" value={values.description} onChange={set("description")} maxLength={500} required />
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Label text="Quantity">
          <Input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            value={values.quantity}
            onChange={set("quantity")}
            required
          />
        </Label>
        <Label text={`Rate (${currency.code})`}>
          <Input
            name="rate"
            inputMode="decimal"
            placeholder={currency.decimal_places ? `0.${"0".repeat(currency.decimal_places)}` : "0"}
            value={values.rate}
            onChange={set("rate")}
            required
          />
        </Label>
        {taxRates.length > 0 && (
          <Label text="Tax">
            <Select name="taxRateId" value={values.taxRateId} onChange={set("taxRateId")}>
              <option value="">No tax</option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} {t.percentage}%
                </option>
              ))}
            </Select>
          </Label>
        )}
        <div className="flex flex-col justify-end text-sm text-zinc-600">
          <span className="text-xs">Amount</span>
          <span className="py-2 font-medium text-zinc-900">
            {preview ? formatMoney(preview.lineTotalMinor, currency) : "—"}
            {preview && preview.taxMinor > 0 && (
              <span className="block text-xs font-normal text-zinc-500">
                + {formatMoney(preview.taxMinor, currency)} tax
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Btn>
        {onDone && initial && (
          <Btn type="button" variant="link" onClick={onDone}>
            Cancel
          </Btn>
        )}
        <Message error={state.error} />
      </div>
    </form>
  );
}

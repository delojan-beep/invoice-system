"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useFormAction } from "@/src/ui/use-form-action";
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LineFormValues, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();
  const errorId = (key: keyof LineFormValues) => `${ids}-${key}-error`;
  const describe = (key: keyof LineFormValues) => ({
    "aria-invalid": fieldErrors[key] ? true : undefined,
    "aria-describedby": fieldErrors[key] ? errorId(key) : undefined,
  });

  const [state, run, pending] = useFormAction(async (prev: FormState, formData: FormData) => {
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

  // Checked here instead of by the browser, so each message sits beside its field.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    const errors: Partial<Record<keyof LineFormValues, string>> = {};
    if (!values.lineTypeId) errors.lineTypeId = "Choose a type.";
    if (!values.description.trim()) errors.description = "Enter a description.";
    if (!(quantity > 0)) errors.quantity = "Enter a quantity above zero.";
    if (rateMinor === null) errors.rate = "Enter a rate, for example 1500.00.";
    setFieldErrors(errors);

    const first = Object.keys(errors)[0];
    if (first) {
      e.preventDefault();
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    run(e);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label
          text="Type"
          hint={needsReceipt ? "Needs a receipt before you submit" : undefined}
          error={fieldErrors.lineTypeId}
          errorId={errorId("lineTypeId")}
        >
          <Select name="lineTypeId" value={values.lineTypeId} onChange={set("lineTypeId")} required {...describe("lineTypeId")}>
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
        <Label text="Description" error={fieldErrors.description} errorId={errorId("description")}>
          <Input
            name="description"
            value={values.description}
            onChange={set("description")}
            maxLength={500}
            required
            {...describe("description")}
          />
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Label text="Quantity" error={fieldErrors.quantity} errorId={errorId("quantity")}>
          <Input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            value={values.quantity}
            onChange={set("quantity")}
            required
            {...describe("quantity")}
          />
        </Label>
        <Label text={`Rate (${currency.code})`} error={fieldErrors.rate} errorId={errorId("rate")}>
          <Input
            name="rate"
            inputMode="decimal"
            placeholder={currency.decimal_places ? `0.${"0".repeat(currency.decimal_places)}` : "0"}
            value={values.rate}
            onChange={set("rate")}
            required
            {...describe("rate")}
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
        <div className="flex flex-col justify-end text-base text-ink-600">
          <span className="text-sm">Amount</span>
          <span className="py-2 font-medium text-ink-900">
            {preview ? formatMoney(preview.lineTotalMinor, currency) : "—"}
            {preview && preview.taxMinor > 0 && (
              <span className="block text-sm font-normal text-ink-600">
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

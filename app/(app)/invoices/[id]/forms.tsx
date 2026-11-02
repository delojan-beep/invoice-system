"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/src/ui/use-form-action";
import { Btn, Input, Label, Message, Select } from "@/src/ui/controls";
import type { FormState } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Marks review started the first time the approver actually opens the page.
 * Runs in the browser, so a prefetch of the page never locks an invoice.
 */
export function ReviewStarter({ start }: { start: () => Promise<void> }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);
  return null;
}

export function RejectForm({ action }: { action: Action }) {
  const [state, run, pending] = useFormAction(action, {});
  return (
    <form onSubmit={run} className="flex flex-col gap-3">
      <Label text="What needs fixing?" hint="The employee sees this comment">
        <textarea
          name="comment"
          rows={3}
          maxLength={2000}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-sm"
        />
      </Label>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="danger" disabled={pending}>
          {pending ? "Sending…" : "Reject and send back"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </form>
  );
}

type Currency = { code: string };

export function ConfirmPaymentForm({
  action,
  invoiceCurrency,
  currencies,
  defaultFeePaidBy,
  initial,
}: {
  action: Action;
  invoiceCurrency: string;
  currencies: Currency[];
  defaultFeePaidBy: "company" | "deducted" | null;
  initial: { transferId: string; sent: string; fee: string; received: string; rate: string; sentCurrency: string | null; receivedCurrency: string | null };
}) {
  const [state, run, pending] = useFormAction(action, {});
  const currencyOptions = currencies.map((c) => (
    <option key={c.code} value={c.code}>
      {c.code}
    </option>
  ));

  return (
    <form onSubmit={run} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Wise transfer ID">
          <Input name="transferId" defaultValue={initial.transferId} required maxLength={100} />
        </Label>
        <Label text="Who paid the Wise fee">
          <Select name="feePaidBy" defaultValue={defaultFeePaidBy ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            <option value="company">Company paid</option>
            <option value="deducted">Deducted from payment</option>
          </Select>
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Label text="Amount sent">
          <Input name="sent" inputMode="decimal" defaultValue={initial.sent} required />
        </Label>
        <Label text="Sent in">
          <Select name="sentCurrency" defaultValue={initial.sentCurrency ?? "CAD"}>
            {currencyOptions}
          </Select>
        </Label>
        <Label text="Wise fee" hint="In the sent currency">
          <Input name="fee" inputMode="decimal" defaultValue={initial.fee} />
        </Label>
        <Label text="Actual rate" hint="From the Wise receipt">
          <Input name="rate" inputMode="decimal" defaultValue={initial.rate} />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Label text="Amount received">
          <Input name="received" inputMode="decimal" defaultValue={initial.received} required />
        </Label>
        <Label text="Received in">
          <Select name="receivedCurrency" defaultValue={initial.receivedCurrency ?? invoiceCurrency}>
            {currencyOptions}
          </Select>
        </Label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : "Confirm payment"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </form>
  );
}

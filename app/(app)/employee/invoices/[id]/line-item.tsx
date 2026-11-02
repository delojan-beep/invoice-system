"use client";

import { useState } from "react";
import { formatFileSize } from "@/src/domain/format";
import { formatMoney, type CurrencyInfo } from "@/src/domain/money";
import { ActionButton } from "@/src/ui/action-button";
import { Btn } from "@/src/ui/controls";
import type { FormState } from "./actions";
import { LineForm, type LineFormValues } from "./line-form";
import { Uploader } from "./uploader";

type Attachment = { id: string; file_name: string; size_bytes: number };

export type LineView = {
  id: string;
  description: string;
  quantity: number;
  rate_minor: number;
  tax_minor: number;
  line_total_minor: number;
  line_type: { id: string; name: string; receipt_required: boolean } | null;
  tax_rate: { id: string; label: string; percentage: number } | null;
  attachments: Attachment[];
};

/** One invoice line: read view, edit form, receipts. */
export function LineItem({
  line,
  currency,
  editable,
  employeeId,
  invoiceId,
  lineTypes,
  taxRates,
  saveLine,
  deleteLine,
  recordAttachment,
  removeAttachment,
}: {
  line: LineView;
  currency: CurrencyInfo;
  editable: boolean;
  employeeId: string;
  invoiceId: string;
  lineTypes: { id: string; name: string; receipt_required: boolean }[];
  taxRates: { id: string; name: string; percentage: number; label: string }[];
  saveLine: (prev: FormState, formData: FormData) => Promise<FormState>;
  deleteLine: (prev: FormState) => Promise<FormState>;
  recordAttachment: (file: { path: string; fileName: string; mimeType: string; size: number }) => Promise<FormState>;
  removeAttachment: Record<string, (prev: FormState) => Promise<FormState>>;
}) {
  const [editing, setEditing] = useState(false);
  const missingReceipt = line.line_type?.receipt_required && line.attachments.length === 0;

  if (editing) {
    const places = currency.decimal_places;
    const initial: LineFormValues = {
      lineTypeId: line.line_type?.id ?? "",
      description: line.description,
      quantity: String(line.quantity),
      rate: (line.rate_minor / 10 ** places).toFixed(places),
      taxRateId: line.tax_rate?.id ?? "",
    };
    return (
      <li className="py-4">
        <LineForm
          action={saveLine}
          currency={currency}
          lineTypes={lineTypes}
          taxRates={taxRates}
          initial={initial}
          submitLabel="Save line"
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">{line.description}</p>
          <p className="text-sm text-zinc-500">
            {line.line_type?.name} · {line.quantity} × {formatMoney(line.rate_minor, currency)}
            {line.tax_rate && ` · ${line.tax_rate.label} ${line.tax_rate.percentage}%`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-zinc-900">{formatMoney(line.line_total_minor, currency)}</p>
          {line.tax_minor > 0 && (
            <p className="text-xs text-zinc-500">+ {formatMoney(line.tax_minor, currency)} tax</p>
          )}
        </div>
      </div>

      {(line.attachments.length > 0 || missingReceipt) && (
        <ul className="flex flex-col gap-1">
          {line.attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
              <a href={`/attachments/${a.id}`} target="_blank" rel="noopener" className="text-blue-700 hover:underline">
                {a.file_name}
              </a>
              <span className="text-zinc-500">{formatFileSize(a.size_bytes)}</span>
              {editable && removeAttachment[a.id] && (
                <ActionButton
                  action={removeAttachment[a.id]}
                  label="Remove"
                  pendingLabel="Removing…"
                  variant="link"
                  confirmText={`Remove ${a.file_name}?`}
                />
              )}
            </li>
          ))}
          {missingReceipt && <li className="text-sm text-amber-800">Receipt needed before you submit</li>}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Uploader employeeId={employeeId} invoiceId={invoiceId} record={recordAttachment} />
          <Btn type="button" variant="link" onClick={() => setEditing(true)}>
            Edit
          </Btn>
          <ActionButton
            action={deleteLine}
            label="Delete"
            pendingLabel="Deleting…"
            variant="link"
            confirmText={`Delete "${line.description}"${line.attachments.length ? " and its receipts" : ""}?`}
          />
        </div>
      )}
    </li>
  );
}

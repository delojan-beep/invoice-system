import type { InvoiceDetail } from "@/src/domain/invoice-queries";
import { formatFileSize } from "@/src/domain/format";
import { formatMoney } from "@/src/domain/money";

/** Read-only lines, receipts and totals (subtotal, tax by rate, total). */
export function InvoiceLines({ invoice }: { invoice: InvoiceDetail }) {
  const currency = invoice.currency!;
  const taxByRate = new Map<string, number>();
  for (const line of invoice.lines) {
    if (line.tax_rate && line.tax_minor > 0) {
      const key = `${line.tax_rate.label} ${line.tax_rate.percentage}%`;
      taxByRate.set(key, (taxByRate.get(key) ?? 0) + line.tax_minor);
    }
  }

  return (
    <>
      <ul className="divide-y divide-zinc-100">
        {invoice.lines.map((line) => {
          const missingReceipt = line.line_type?.receipt_required && line.attachments.length === 0;
          return (
            <li key={line.id} className="flex flex-col gap-2 py-3">
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
                <ul className="flex flex-col gap-1 text-sm">
                  {line.attachments.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <a href={`/attachments/${a.id}`} target="_blank" rel="noopener" className="text-blue-700 hover:underline">
                        {a.file_name}
                      </a>
                      <span className="text-zinc-500">{formatFileSize(a.size_bytes)}</span>
                    </li>
                  ))}
                  {missingReceipt && <li className="text-amber-800">No receipt attached</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 flex flex-col gap-1 border-t border-zinc-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-600">Subtotal</dt>
          <dd className="text-zinc-900">{formatMoney(invoice.subtotal_minor, currency)}</dd>
        </div>
        {[...taxByRate].map(([label, amount]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-zinc-600">{label}</dt>
            <dd className="text-zinc-900">{formatMoney(amount, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between text-base font-semibold">
          <dt className="text-zinc-900">Total</dt>
          <dd className="text-zinc-900">{formatMoney(invoice.total_minor, currency)}</dd>
        </div>
      </dl>
    </>
  );
}

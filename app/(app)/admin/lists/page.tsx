import { requireAccess } from "@/src/auth/dal";
import { getReferenceLists } from "@/src/domain/admin-queries";
import { ActionButton } from "@/src/ui/action-button";
import { Card } from "@/src/ui/controls";
import { addCurrency, addLineType, addTaxRate, toggle } from "../actions";
import { AddForm, CurrencyFields, LineTypeFields, TaxFields } from "./forms";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

function OnOff({ on }: { on: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${on ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
      {on ? "On" : "Off"}
    </span>
  );
}

export default async function ListsPage() {
  await requireAccess(["admin"]);
  const { currencies, taxRates, lineTypes } = await getReferenceLists();
  const activeCurrencies = currencies.filter((c) => c.active).map((c) => c.code);
  const row = "flex flex-wrap items-center justify-between gap-3 py-3";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Currencies, tax and line types</h1>

      <Card title="Currencies">
        <p className="mb-2 text-sm text-zinc-600">An invoice uses one currency; amounts are never converted silently.</p>
        <ul className="divide-y divide-zinc-100">
          {currencies.map((c) => (
            <li key={c.code} className={row}>
              <span className="text-sm text-zinc-900">
                <span className="font-mono font-medium">{c.code}</span> · {c.name} · {c.symbol} · {c.decimal_places} decimals
              </span>
              <span className="flex items-center gap-3">
                <OnOff on={c.active} />
                <ActionButton
                  action={toggle.bind(null, { table: "currencies", key: c.code, field: "active", value: !c.active })}
                  label={c.active ? "Switch off" : "Switch on"}
                  variant="link"
                />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={addCurrency} label="Add currency">
          <CurrencyFields />
        </AddForm>
      </Card>

      <Card title="Tax rates">
        <p className="mb-2 text-sm text-zinc-600">
          Switch a rate on only once the accountant confirms it applies. Employees can pick active rates for invoices in
          that rate&apos;s currency.
        </p>
        <ul className="divide-y divide-zinc-100">
          {taxRates.map((t) => (
            <li key={t.id} className={row}>
              <span className="text-sm text-zinc-900">
                <span className="font-medium">{t.name}</span> · {t.percentage}% · shown as {t.label} · {t.currency_code}
              </span>
              <span className="flex items-center gap-3">
                <OnOff on={t.active} />
                <ActionButton
                  action={toggle.bind(null, { table: "tax_rates", key: t.id, field: "active", value: !t.active })}
                  label={t.active ? "Switch off" : "Switch on"}
                  variant="link"
                  confirmText={t.active ? undefined : `Switch on ${t.name}? Confirm the accountant has approved it.`}
                />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={addTaxRate} label="Add tax rate">
          <TaxFields currencies={activeCurrencies} />
        </AddForm>
      </Card>

      <Card title="Line types">
        <ul className="divide-y divide-zinc-100">
          {lineTypes.map((t) => (
            <li key={t.id} className={row}>
              <span className="text-sm text-zinc-900">
                <span className="font-medium">{t.name}</span> · {t.receipt_required ? "receipt required" : "receipt optional"}
              </span>
              <span className="flex items-center gap-3">
                <ActionButton
                  action={toggle.bind(null, { table: "line_types", key: t.id, field: "receipt_required", value: !t.receipt_required })}
                  label={t.receipt_required ? "Make receipt optional" : "Require receipt"}
                  variant="link"
                />
                <OnOff on={t.active} />
                <ActionButton
                  action={toggle.bind(null, { table: "line_types", key: t.id, field: "active", value: !t.active })}
                  label={t.active ? "Switch off" : "Switch on"}
                  variant="link"
                />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={addLineType} label="Add line type">
          <LineTypeFields />
        </AddForm>
      </Card>
    </div>
  );
}

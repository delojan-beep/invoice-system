"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import { Btn, Input, Label, Message, Select, Textarea } from "@/src/ui/controls";
import { useFormAction } from "@/src/ui/use-form-action";
import type { FormState } from "../actions";

export type SettingsValues = {
  reviewPeriodDays: number;
  dailySummaryTime: string;
  monthlyDay: number;
  monthlyTime: string;
  monthlyTimezone: string;
  summaryRecipients: string[];
  reminderFields: string[];
  invoiceNumberFormat: string;
  baseCurrency: string;
  wiseFeePayer: string;
  companyName: string;
  companyBn: string;
  companyAddress: string;
  wording: Record<string, string>;
};


const WORDING: [string, string][] = [
  ["status_update", "Status emails to employees"],
  ["daily_summary", "CEO's daily summary"],
  ["deadline_warning", "Review deadline warning"],
  ["overdue_alert", "Overdue alert to accounts"],
  ["monthly_summary", "Monthly summary"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0">
      <legend className="pb-1 text-base font-semibold text-zinc-900">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SettingsForm({
  action,
  initial,
  currencies,
  timezones,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: SettingsValues;
  currencies: string[];
  timezones: string[];
}) {
  const [state, run, pending] = useFormAction(action);
  const check = (name: string, value: string, label: string, list: string[]) => (
    <label key={value} className="flex items-center gap-2 text-sm text-zinc-800">
      <input type="checkbox" name={name} value={value} defaultChecked={list.includes(value)} className="h-4 w-4" />
      {label}
    </label>
  );

  return (
    <CheckedForm onSubmit={run} className="flex flex-col gap-6">
      <Section title="Review and numbering">
        <div className="grid gap-3 sm:grid-cols-3">
          <Label text="Review period (days)" hint="From each submission">
            <Input name="review_period_days" type="number" min={1} max={60} defaultValue={initial.reviewPeriodDays} required />
          </Label>
          <Label text="Invoice number format" hint="{EMP} code, {YYYY} {MM} month, {NNN} running number">
            <Input name="invoice_number_format" defaultValue={initial.invoiceNumberFormat} required className="font-mono" />
          </Label>
          <Label text="Base currency for reports">
            <Select name="base_currency" defaultValue={initial.baseCurrency}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Label>
        </div>
      </Section>

      <Section title="Emails">
        <div className="grid gap-3 sm:grid-cols-4">
          <Label text="Daily summary time" hint="In the CEO's timezone">
            <Input name="daily_summary_time" type="time" defaultValue={initial.dailySummaryTime} required />
          </Label>
          <Label text="Monthly summary day">
            <Input name="monthly_day" type="number" min={1} max={28} defaultValue={initial.monthlyDay} required />
          </Label>
          <Label text="Monthly summary time">
            <Input name="monthly_time" type="time" defaultValue={initial.monthlyTime} required />
          </Label>
          <Label text="Monthly summary timezone">
            <Select name="monthly_timezone" defaultValue={initial.monthlyTimezone}>
              {timezones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">Monthly summary goes to</span>
          <div className="flex flex-wrap gap-4">
            {check("summary_recipients", "approver", "CEO (approver)", initial.summaryRecipients)}
            {check("summary_recipients", "accounts", "Accounts", initial.summaryRecipients)}
            {check("summary_recipients", "admin", "Admin", initial.summaryRecipients)}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">Daily summary shows</span>
          <div className="flex flex-wrap gap-4">
            {check("reminder_fields", "number", "Invoice number", initial.reminderFields)}
            {check("reminder_fields", "date", "Date", initial.reminderFields)}
            {check("reminder_fields", "total", "Total", initial.reminderFields)}
          </div>
        </div>
      </Section>

      <Section title="Payments">
        <Label text="Who pays Wise fees (default)">
          <Select name="wise_fee_payer" defaultValue={initial.wiseFeePayer} className="sm:max-w-xs">
            <option value="">Not decided yet</option>
            <option value="company">Company pays: employee gets the full amount</option>
            <option value="deducted">Deducted from the payment</option>
          </Select>
        </Label>
      </Section>

      <Section title="Company details on invoice PDFs">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Company name">
            <Input name="company_name" defaultValue={initial.companyName} required />
          </Label>
          <Label text="Canadian Business Number (BN)">
            <Input name="company_bn" defaultValue={initial.companyBn} maxLength={50} />
          </Label>
        </div>
        <Label text="Company address">
          <Textarea name="company_address" rows={3} defaultValue={initial.companyAddress} maxLength={500} />
        </Label>
      </Section>

      <Section title="Email wording">
        <p className="text-sm text-zinc-600">Optional note added at the top of each kind of email.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORDING.map(([key, label]) => (
            <Label key={key} text={label}>
              <Textarea name={`wording_${key}`} rows={2} defaultValue={initial.wording[key] ?? ""} maxLength={1000} />
            </Label>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </CheckedForm>
  );
}

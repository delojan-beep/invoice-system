import { requireAccess } from "@/src/auth/dal";
import { getAllSettings, getReferenceLists, timezones } from "@/src/domain/admin-queries";
import { Card } from "@/src/ui/controls";
import { saveSettings } from "../actions";
import { SettingsForm } from "./settings-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const list = (v: unknown, fallback: string[]) => (Array.isArray(v) ? (v as string[]) : fallback);

export default async function SettingsPage() {
  await requireAccess(["admin"]);
  const [s, lists] = await Promise.all([getAllSettings(), getReferenceLists()]);
  const monthly = (s.monthly_summary ?? {}) as { day?: number; time?: string; timezone?: string };
  const company = (s.company ?? {}) as { name?: string; business_number?: string; address?: string };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
      <Card>
        <SettingsForm
          action={saveSettings}
          currencies={lists.currencies.filter((c) => c.active).map((c) => c.code)}
          timezones={timezones()}
          initial={{
            reviewPeriodDays: Number(s.review_period_days) || 10,
            dailySummaryTime: str(s.daily_summary_time, "08:00"),
            monthlyDay: Number(monthly.day) || 15,
            monthlyTime: monthly.time ?? "18:30",
            monthlyTimezone: monthly.timezone ?? "Asia/Colombo",
            summaryRecipients: list(s.summary_recipients, ["approver", "accounts"]),
            reminderFields: list(s.reminder_fields, ["number", "date", "total"]),
            invoiceNumberFormat: str(s.invoice_number_format, "QN-{EMP}-{YYYY}-{MM}-{NNN}"),
            baseCurrency: str(s.base_currency, "CAD"),
            wiseFeePayer: str(s.wise_fee_payer, ""),
            companyName: company.name ?? "QNetwork",
            companyBn: company.business_number ?? "",
            companyAddress: company.address ?? "",
            wording: (s.email_wording ?? {}) as Record<string, string>,
          }}
        />
      </Card>
    </div>
  );
}

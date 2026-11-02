import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";
import { getAllSettings, getReferenceLists, listUsers } from "@/src/domain/admin-queries";
import { Card } from "@/src/ui/controls";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

type Check = { ok: boolean; label: string; fix: string; href?: string };

// What still needs doing before go-live, worked out from settings and setup.
export default async function AdminPage() {
  await requireAccess(["admin"]);
  const [settings, lists, users] = await Promise.all([getAllSettings(), getReferenceLists(), listUsers()]);

  const company = (settings.company ?? {}) as { business_number?: string; address?: string };
  const employees = users.filter((u) => u.status === "active" && u.roles.includes("employee"));
  const incomplete = employees.filter((u) => !u.employee_code || !u.default_currency);
  const activeTax = lists.taxRates.filter((t) => t.active);

  const checks: Check[] = [
    {
      ok: Boolean(company.business_number && company.address),
      label: "Company Business Number and address",
      fix: "Printed on every invoice PDF; Sri Lankan banks ask for them.",
      href: "/admin/settings",
    },
    {
      ok: settings.wise_fee_payer === "company" || settings.wise_fee_payer === "deducted",
      label: "Who pays Wise fees",
      fix: "Choose company or deducted; it pre-fills payment confirmations.",
      href: "/admin/settings",
    },
    {
      ok: incomplete.length === 0,
      label: "Every employee has a code and a default currency",
      fix: incomplete.length ? `Missing for: ${incomplete.map((u) => u.name).join(", ")}` : "",
      href: "/admin/users",
    },
    {
      ok: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      label: "Email sending (Resend)",
      fix: "Set RESEND_API_KEY and EMAIL_FROM on a verified domain. Until then emails go to the local inbox only.",
    },
    {
      ok: Boolean(process.env.CRON_SECRET),
      label: "Scheduled jobs",
      fix: "Set CRON_SECRET in Vercel; vercel.json runs /api/cron every 15 minutes (Pro plan).",
    },
    {
      ok: Boolean(process.env.FX_PROVIDER),
      label: "Exchange-rate provider",
      fix: "Choose a provider and set FX_PROVIDER. Until then reports have no CAD value.",
    },
    {
      ok: Boolean(process.env.GOOGLE_SA_JSON && process.env.BACKUP_SHEET_ID),
      label: "Google Sheet backup",
      fix: "Set GOOGLE_SA_JSON (service account key) and BACKUP_SHEET_ID, and share the sheet with that account.",
    },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>

      <Card title={`Ready for launch: ${done} of ${checks.length}`}>
        <ul className="flex flex-col gap-3">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3 text-sm">
              <span aria-hidden className={c.ok ? "text-emerald-600" : "text-amber-600"}>
                {c.ok ? "✓" : "○"}
              </span>
              <div>
                <p className="font-medium text-zinc-900">
                  {c.href && !c.ok ? (
                    <Link href={c.href} className="hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                  <span className="sr-only">{c.ok ? " (done)" : " (to do)"}</span>
                </p>
                {!c.ok && c.fix && <p className="text-zinc-600">{c.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="At a glance">
        <ul className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
          <li>{users.filter((u) => u.status === "active").length} active users ({employees.length} employees)</li>
          <li>{lists.currencies.filter((c) => c.active).map((c) => c.code).join(", ")} in use</li>
          <li>
            {activeTax.length
              ? `Tax on: ${activeTax.map((t) => t.name).join(", ")}`
              : "Tax rates are switched off (until the accountant confirms)"}
          </li>
          <li>{lists.lineTypes.filter((t) => t.active).length} line types</li>
        </ul>
      </Card>
    </div>
  );
}

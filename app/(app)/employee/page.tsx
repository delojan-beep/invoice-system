import { requireAccess } from "@/src/auth/dal";
import { AreaPlaceholder } from "@/src/ui/placeholder";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function EmployeePage() {
  await requireAccess(["employee"]);
  return (
    <AreaPlaceholder
      title="My invoices"
      milestone="M3"
      items={["This month's draft, created automatically", "Line items and receipts", "Confirm, submit, recall and resubmit", "Mark Paid when the money arrives"]}
    />
  );
}

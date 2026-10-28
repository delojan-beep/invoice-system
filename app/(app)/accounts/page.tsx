import { requireAccess } from "@/src/auth/dal";
import { AreaPlaceholder } from "@/src/ui/placeholder";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function AccountsPage() {
  await requireAccess(["accounts"]);
  return (
    <AreaPlaceholder
      title="Accounts"
      milestone="M4"
      items={["All invoices, filtered by employee, month, currency and status", "Confirm payments against Wise", "Export to CSV"]}
    />
  );
}

import { requireAccess } from "@/src/auth/dal";
import { AreaPlaceholder } from "@/src/ui/placeholder";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function ApproverPage() {
  await requireAccess(["approver"]);
  return (
    <AreaPlaceholder
      title="Approvals"
      milestone="M4"
      items={["Invoices waiting for review, overdue first", "Approve one or several at once", "Reject with a comment", "Mark several Paid at once"]}
    />
  );
}

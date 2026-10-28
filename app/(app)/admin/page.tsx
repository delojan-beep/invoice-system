import { requireAccess } from "@/src/auth/dal";
import { AreaPlaceholder } from "@/src/ui/placeholder";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function AdminPage() {
  await requireAccess(["admin"]);
  return (
    <AreaPlaceholder
      title="Admin"
      milestone="M6"
      items={["Users, roles and active status", "Currencies, tax rates and line types", "Settings and email wording", "Company details for invoice PDFs"]}
    />
  );
}

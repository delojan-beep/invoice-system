import Link from "next/link";
import { rolePath, ROLES, type AppRole } from "@/src/auth/access";
import { requireAccess } from "@/src/auth/dal";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const ROLE_LABELS: Record<AppRole, string> = {
  employee: "My invoices",
  approver: "Approvals",
  accounts: "Accounts",
  admin: "Admin",
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireAccess();
  const areas = ROLES.filter((r) => viewer.roles.includes(r));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold text-zinc-900">QNetwork Invoices</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {areas.map((role) => (
              <Link key={role} href={rolePath(role)} className="text-zinc-700 hover:text-blue-700">
                {ROLE_LABELS[role]}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-600">
            <span>{viewer.name || viewer.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

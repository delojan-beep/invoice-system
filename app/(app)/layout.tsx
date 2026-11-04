import Link from "next/link";
import { rolePath, ROLES, type AppRole } from "@/src/auth/access";
import { requireAccess } from "@/src/auth/dal";
import { NavLink } from "@/src/ui/nav-link";
import { ThemeToggle } from "@/src/ui/theme-toggle";

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
    <div className="flex min-h-screen flex-col bg-ink-50 text-ink-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-base focus:font-medium focus:text-brand-800 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="border-b border-ink-200 bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1">
          <span className="py-2 font-medium text-brand-900">Invoices</span>
          <nav aria-label="Main" className="flex flex-wrap gap-4">
            {areas.map((role) => (
              <NavLink key={role} href={rolePath(role)}>
                {ROLE_LABELS[role]}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1 text-sm text-ink-600">
            <ThemeToggle />
            <span className="hidden px-3 sm:inline">{viewer.name || viewer.email}</span>
            <Link
              href="/set-password"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-ink-700 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900"
            >
              Change password
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-ink-700 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 focus:outline-none sm:py-8">
        {children}
      </main>
    </div>
  );
}

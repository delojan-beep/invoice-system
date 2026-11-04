import { requireAccess } from "@/src/auth/dal";
import { NavLink } from "@/src/ui/nav-link";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/lists", label: "Currencies, tax, line types" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAccess(["admin"]);
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Admin sections" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-200">
        {SECTIONS.map((s) => (
          <NavLink key={s.href} href={s.href} exact={s.href === "/admin"}>
            {s.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}

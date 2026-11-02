import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";

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
      <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-200 pb-3 text-sm">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="text-zinc-700 hover:text-blue-700">
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

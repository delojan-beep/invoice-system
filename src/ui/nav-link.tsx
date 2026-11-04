"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Nav link that marks where you are for sighted and screen-reader users. It also
 * stays marked on pages beneath it; `exact` turns that off, for a link whose
 * address is the start of its neighbours' (/admin next to /admin/users).
 */
export function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-1 text-base font-medium transition-colors duration-150 ${
        active
          ? "border-accent-600 text-brand-800"
          : "border-transparent text-ink-700 hover:border-ink-300 hover:text-ink-900"
      }`}
    >
      {children}
    </Link>
  );
}

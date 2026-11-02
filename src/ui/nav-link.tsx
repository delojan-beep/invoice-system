"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Header nav link that marks the current area for sighted and screen-reader users. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-medium transition-colors duration-150 ${
        active
          ? "border-blue-700 text-blue-800"
          : "border-transparent text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}

import Link from "next/link";
import { AuthCard } from "@/src/ui/auth-card";

/** For an address that matches nothing, outside the signed-in pages. */
export default function NotFound() {
  return (
    <AuthCard title="Page not found">
      <p className="text-base text-ink-600">Check the link, or go back to your home page.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-base font-medium text-on-brand transition-colors duration-150 hover:bg-brand-800"
      >
        Go to my home page
      </Link>
    </AuthCard>
  );
}

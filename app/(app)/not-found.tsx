import Link from "next/link";

/** For an invoice or page that doesn't exist, or that this account can't open. Stays inside the app's header. */
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-title font-medium text-ink-900">Page not found</h1>
      <p className="text-base text-ink-600">It may have been removed, or your account may not be able to open it.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-base font-medium text-on-brand transition-colors duration-150 hover:bg-brand-800"
      >
        Go to my home page
      </Link>
    </div>
  );
}

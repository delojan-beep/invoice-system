/** Shown while a signed-in page loads, so a slow navigation never leaves the content area blank. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
      <div aria-hidden className="h-40 animate-pulse rounded-xl border border-ink-200 bg-surface" />
      <div aria-hidden className="h-64 animate-pulse rounded-xl border border-ink-200 bg-surface" />
    </div>
  );
}

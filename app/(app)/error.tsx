"use client";

import { ErrorPanel } from "@/src/ui/error-panel";

/** A signed-in page failed. The header stays, so people can still move around the app. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-title font-medium text-ink-900">Something went wrong</h1>
      <ErrorPanel error={error} retry={retry} />
    </div>
  );
}

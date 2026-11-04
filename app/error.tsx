"use client";

import { AuthCard } from "@/src/ui/auth-card";
import { ErrorPanel } from "@/src/ui/error-panel";

/** Sign-in pages, and failures in the signed-in layout itself, where there is no header to keep. */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <AuthCard title="Something went wrong">
      <ErrorPanel error={error} retry={retry} />
    </AuthCard>
  );
}

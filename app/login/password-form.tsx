"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Field, Notice } from "@/src/ui/auth-card";
import { PasswordField } from "@/src/ui/password-field";
import { useFormAction } from "@/src/ui/use-form-action";
import { signInWithPassword } from "./actions";

// `earlierError` came with the page (a failed Google sign-in, say), and `children`
// sit between it and the form. It gives way to this form's own error, so only
// the latest problem shows.
export function PasswordForm({ earlierError, children }: { earlierError?: string; children?: ReactNode }) {
  const [state, onSubmit, pending] = useFormAction(signInWithPassword);

  return (
    <>
      {earlierError && !state.error && <Notice tone="error">{earlierError}</Notice>}
      {children}
      {/* method="post" keeps the password out of the address if someone submits before the page's scripts load. */}
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <PasswordField label="Password" name="password" autoComplete="current-password" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <Link href="/login?mode=link" className="inline-flex min-h-11 items-center text-sm text-brand-700 hover:underline">
          Email me a sign-in link instead
        </Link>
      </form>
    </>
  );
}

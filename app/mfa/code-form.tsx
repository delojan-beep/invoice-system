"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import { useActionState } from "react";
import { Button, Field, Notice } from "@/src/ui/auth-card";
import { verifyTotp, type VerifyState } from "./actions";

export function CodeForm({ factorId, submitLabel }: { factorId: string; submitLabel: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyTotp, {});

  return (
    <CheckedForm action={action} className="flex flex-col gap-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="factorId" value={factorId} />
      <Field
        label="6-digit code"
        name="code"
        inputMode="numeric"
        pattern="\d{6}"
        data-invalid-message="Enter the 6-digit code from your authenticator app."
        maxLength={6}
        autoComplete="one-time-code"
        autoFocus
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : submitLabel}
      </Button>
    </CheckedForm>
  );
}

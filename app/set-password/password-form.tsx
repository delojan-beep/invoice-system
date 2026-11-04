"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import { Button, Notice } from "@/src/ui/auth-card";
import { Message } from "@/src/ui/controls";
import { PasswordField } from "@/src/ui/password-field";
import { useFormAction } from "@/src/ui/use-form-action";
import { setPassword } from "./actions";

export function PasswordForm() {
  const [state, onSubmit, pending] = useFormAction(setPassword);
  const invalid = (field: string) => (state.field === field ? true : undefined);

  return (
    // method="post" keeps the password out of the address if someone submits before the page's scripts load.
    <CheckedForm method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error && !state.field && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-col gap-1">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          aria-describedby="password-help"
          aria-invalid={invalid("password")}
          autoFocus
          required
        />
        <p id="password-help" className="text-sm text-ink-600">
          At least 10 characters, with both letters and numbers.
        </p>
        {state.field === "password" && <Message error={state.error} />}
      </div>
      <div className="flex flex-col gap-1">
        <PasswordField
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          aria-invalid={invalid("confirm")}
          required
        />
        {state.field === "confirm" && <Message error={state.error} />}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </CheckedForm>
  );
}

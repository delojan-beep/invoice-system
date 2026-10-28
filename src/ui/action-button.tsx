"use client";

import { useActionState } from "react";
import { Btn, Message } from "./controls";

type State = { error?: string; message?: string };

/**
 * A one-click server action (recall, remove, delete) with an optional
 * confirmation prompt and its error shown underneath.
 */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirmText,
  variant = "secondary",
}: {
  action: (prev: State) => Promise<State>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "danger" | "link";
}) {
  const [state, run, pending] = useActionState(action, {});

  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <Btn type="submit" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Btn>
      <Message error={state.error} />
    </form>
  );
}

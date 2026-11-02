"use client";

import { startTransition, useActionState, type FormEvent } from "react";

export type FormResult = { error?: string; message?: string };

/**
 * useActionState for forms that must keep what people typed when the server
 * returns an error. React clears a <form action={…}> after every submission,
 * even a failed one; submitting through onSubmit avoids that.
 */
export function useFormAction(
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>,
  initial: FormResult = {},
) {
  const [state, dispatch, pending] = useActionState(action, initial);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };

  return [state, onSubmit, pending] as const;
}

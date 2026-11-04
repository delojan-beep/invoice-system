"use client";

import { createContext, useContext, useId, useState, useSyncExternalStore, type ComponentProps, type SubmitEvent } from "react";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Errors = Record<string, string>;

const noSubscribe = () => () => {};

const FieldErrorsContext = createContext<{ errors: Errors; idPrefix: string; clear: (name: string) => void }>({
  errors: {},
  idPrefix: "",
  clear: () => {},
});

/** The field's visible label: the first text in its <label>, before any hint or message. */
function labelText(el: Field) {
  return el.labels?.[0]?.childNodes[0]?.textContent?.trim() || "This field";
}

/** Plain-language message for a field the browser rejects. Set data-invalid-message to override. */
function messageFor(el: Field): string {
  if (el.dataset.invalidMessage) return el.dataset.invalidMessage;
  const v = el.validity;
  if (v.valueMissing) return `${labelText(el)} is required.`;
  if (v.typeMismatch && el instanceof HTMLInputElement && el.type === "email") {
    return "Enter an email address, like name@example.com.";
  }
  if (v.rangeUnderflow) return `Enter ${(el as HTMLInputElement).min} or more.`;
  if (v.rangeOverflow) return `Enter ${(el as HTMLInputElement).max} or less.`;
  if (v.stepMismatch || v.badInput) return "Enter a valid number.";
  if (v.patternMismatch) return "Check the format and try again.";
  return "Check this field.";
}

/**
 * A <form> that checks its required and typed fields on submit, instead of the browser's
 * pop-up bubbles, and shows each problem beside its field (see useFieldError in controls.tsx).
 * Valid submits go on to onSubmit, or to the form's server action, unchanged.
 */
export function CheckedForm({ onSubmit, children, ...props }: ComponentProps<"form">) {
  const [errors, setErrors] = useState<Errors>({});
  const idPrefix = useId();
  // False on the server and until the page's scripts run, so the browser's own checks cover a very early submit.
  const scriptsReady = useSyncExternalStore(noSubscribe, () => true, () => false);

  const clear = (name: string) =>
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const next: Errors = {};
    for (const el of Array.from(form.elements) as Field[]) {
      if (!el.name || !el.willValidate || el.checkValidity()) continue;
      next[el.name] ??= messageFor(el);
    }

    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      e.preventDefault();
      form.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)?.focus();
      return;
    }
    onSubmit?.(e);
  };

  return (
    <form {...props} noValidate={scriptsReady} onSubmit={handleSubmit}>
      <FieldErrorsContext.Provider value={{ errors, idPrefix, clear }}>{children}</FieldErrorsContext.Provider>
    </form>
  );
}

/** For a shared input: its current message, the id to point at, and the attributes that mark it invalid. */
export function useFieldError(name: string | undefined) {
  const { errors, idPrefix, clear } = useContext(FieldErrorsContext);
  const message = name ? errors[name] : undefined;
  const id = name ? `${idPrefix}-${name}-error` : undefined;

  return {
    message,
    id,
    invalidProps: message ? { "aria-invalid": true, "aria-describedby": id } : {},
    clear: () => {
      if (name) clear(name);
    },
  };
}

/** Lucide "circle-alert". */
export function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 size-4 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <span id={id} className="flex items-start gap-1.5 text-base font-normal text-red-700">
      <AlertIcon />
      {message}
    </span>
  );
}

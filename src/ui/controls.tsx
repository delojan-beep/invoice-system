"use client";

import type { ComponentProps, ReactNode } from "react";
import type { InvoiceStatus } from "@/src/domain/invoice";
import { STATUS_LABELS } from "@/src/domain/invoice";
import { AlertIcon, FieldError, useFieldError } from "./checked-form";

type Variant = "primary" | "secondary" | "danger" | "link";

const VARIANTS: Record<Variant, string> = {
  primary: "inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-base font-medium text-on-brand transition-colors duration-150 hover:bg-brand-800 active:bg-brand-900",
  secondary: "inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-400 bg-surface px-4 py-2 text-base font-medium text-ink-800 transition-colors duration-150 hover:bg-ink-50 active:bg-ink-100",
  danger: "inline-flex min-h-11 items-center justify-center rounded-lg border border-red-300 bg-surface px-4 py-2 text-base font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 active:bg-red-100",
  link: "inline-flex min-h-11 items-center rounded-sm text-base font-medium text-brand-700 hover:underline",
};

export function Btn({ variant = "primary", className = "", ...props }: { variant?: Variant } & ComponentProps<"button">) {
  return <button {...props} className={`${VARIANTS[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} />;
}

const FIELD = "rounded-lg border border-ink-400 bg-surface px-3 py-2 text-base text-ink-900 min-h-11 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 aria-[invalid=true]:border-red-600";

export function Label({
  text,
  hint,
  error,
  errorId,
  children,
}: {
  text: string;
  hint?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-base font-medium text-ink-700">
      {text}
      {children}
      {error && (
        <span id={errorId} className="flex items-start gap-1.5 text-base font-normal text-red-700">
          <AlertIcon />
          {error}
        </span>
      )}
      {hint && <span className="text-sm font-normal text-ink-600">{hint}</span>}
    </label>
  );
}

// Inside a CheckedForm, a field shows its own message right after it. Outside one, nothing changes.
export function Input({ onChange, ...props }: ComponentProps<"input">) {
  const field = useFieldError(props.name);
  return (
    <>
      <input
        {...props}
        {...field.invalidProps}
        onChange={(e) => {
          field.clear();
          onChange?.(e);
        }}
        className={`${FIELD} ${props.className ?? ""}`}
      />
      {field.message && field.id && <FieldError id={field.id} message={field.message} />}
    </>
  );
}

export function Select({ onChange, ...props }: ComponentProps<"select">) {
  const field = useFieldError(props.name);
  return (
    <>
      <select
        {...props}
        {...field.invalidProps}
        onChange={(e) => {
          field.clear();
          onChange?.(e);
        }}
        className={`${FIELD} ${props.className ?? ""}`}
      />
      {field.message && field.id && <FieldError id={field.id} message={field.message} />}
    </>
  );
}

export function Textarea({ onChange, ...props }: ComponentProps<"textarea">) {
  const field = useFieldError(props.name);
  return (
    <>
      <textarea
        {...props}
        {...field.invalidProps}
        onChange={(e) => {
          field.clear();
          onChange?.(e);
        }}
        className={`${FIELD} ${props.className ?? ""}`}
      />
      {field.message && field.id && <FieldError id={field.id} message={field.message} />}
    </>
  );
}

export function Message({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-base text-red-700">
        <AlertIcon />
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="flex items-start gap-1.5 text-base text-green-800">
        {/* Lucide "circle-check". */}
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 size-4 shrink-0">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        {message}
      </p>
    );
  }
  return null;
}

// A dot and a word, not a coloured pill: the amount leads and status stays quiet. The word carries
// the meaning, so colour is never the only signal. A hollow dot means approved but not yet paid.
const DOT: Record<InvoiceStatus | "overdue", string> = {
  draft: "bg-ink-400",
  submitted: "bg-brand-600",
  approved: "border-2 border-emerald-600",
  rejected: "bg-accent-600",
  paid: "bg-emerald-600",
  overdue: "bg-red-600",
};

export function StatusBadge({ status, overdue = false }: { status: InvoiceStatus; overdue?: boolean }) {
  const key = overdue ? "overdue" : status;
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ${overdue ? "text-red-700" : "text-ink-700"}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[key]}`} />
      {overdue ? "Overdue" : STATUS_LABELS[status]}
    </span>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title && <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-ink-600">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="rounded-xl border border-ink-200 bg-surface p-4 sm:p-6">{children}</div>
    </section>
  );
}

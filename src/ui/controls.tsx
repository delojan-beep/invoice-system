import type { ComponentProps, ReactNode } from "react";
import type { InvoiceStatus } from "@/src/domain/invoice";
import { STATUS_LABELS } from "@/src/domain/invoice";

type Variant = "primary" | "secondary" | "danger" | "link";

const VARIANTS: Record<Variant, string> = {
  primary: "inline-flex min-h-11 items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-800 active:bg-brand-900",
  secondary: "inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors duration-150 hover:bg-zinc-50 active:bg-zinc-100",
  danger: "inline-flex min-h-11 items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 active:bg-red-100",
  link: "inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand-700 hover:underline",
};

export function Btn({ variant = "primary", className = "", ...props }: { variant?: Variant } & ComponentProps<"button">) {
  return <button {...props} className={`${VARIANTS[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} />;
}

const FIELD = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 min-h-11 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/40 aria-[invalid=true]:border-red-600 sm:text-sm";

export function Label({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-zinc-700">
      {text}
      {children}
      {hint && <span className="text-xs font-normal text-zinc-600">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${FIELD} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${FIELD} ${props.className ?? ""}`} />;
}

export function Message({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="flex items-start gap-1.5 text-sm text-green-800">
        {message}
      </p>
    );
  }
  return null;
}

const BADGE: Record<InvoiceStatus | "overdue", string> = {
  draft: "bg-zinc-100 text-zinc-700",
  submitted: "bg-brand-50 text-brand-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-amber-50 text-amber-900",
  paid: "bg-emerald-600 text-white",
  overdue: "bg-red-50 text-red-800",
};

export function StatusBadge({ status, overdue = false }: { status: InvoiceStatus; overdue?: boolean }) {
  const key = overdue ? "overdue" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[key]}`}>
      {overdue ? "Overdue" : STATUS_LABELS[status]}
    </span>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-zinc-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

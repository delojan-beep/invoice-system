import type { ComponentProps, ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { Btn, Input } from "./controls";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8 text-zinc-900">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex justify-center">
          <BrandLogo size={56} alt="QNetwork" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-brand-900">{title}</h1>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

export function Field({ label, ...input }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      <Input {...input} className="font-normal" />
    </label>
  );
}

export function Button(props: ComponentProps<"button">) {
  return <Btn {...props} />;
}

export function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-200 bg-brand-50 text-brand-900";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

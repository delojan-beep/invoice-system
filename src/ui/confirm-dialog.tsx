"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Btn } from "./controls";

type Options = { message: string; confirmLabel: string; danger?: boolean };

/**
 * Asks before a form submits. Call `guard` first in onSubmit, go on only if it returns
 * true, and render `dialog` inside the form. Saying yes submits the form again.
 */
export function useConfirmedSubmit() {
  const approved = useRef(false);
  const [request, setRequest] = useState<(Options & { form: HTMLFormElement }) | null>(null);

  const guard = (event: { preventDefault(): void; currentTarget: HTMLFormElement }, options: Options) => {
    if (approved.current) {
      approved.current = false;
      return true;
    }
    event.preventDefault();
    setRequest({ ...options, form: event.currentTarget });
    return false;
  };

  const dialog = request && (
    <ConfirmDialog
      {...request}
      onCancel={() => setRequest(null)}
      onConfirm={() => {
        approved.current = true;
        setRequest(null);
        request.form.requestSubmit();
      }}
    />
  );

  return { guard, dialog };
}

/**
 * A native modal dialog: it keeps focus inside, closes on Escape and puts focus back when
 * it closes. Cancel comes first, so it has focus and pressing Enter never confirms by accident.
 */
function ConfirmDialog({
  message,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: Options & { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  // The first question is the heading; anything after it is the detail.
  const end = message.search(/\?\s/);
  const title = end < 0 ? message : message.slice(0, end + 1);
  const detail = end < 0 ? "" : message.slice(end + 1).trim();

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={detail ? `${id}-detail` : undefined}
      onClose={() => (ref.current?.returnValue === "yes" ? onConfirm() : onCancel())}
      // A click on the dimmed area lands on the dialog itself, not on anything inside it.
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[85vh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-ink-200 bg-white p-0 text-ink-900 backdrop:bg-ink-900/50"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id={`${id}-title`} className="text-xl font-medium tracking-tight text-brand-900">
          {title}
        </h2>
        {detail && (
          <p id={`${id}-detail`} className="whitespace-pre-line text-base text-ink-700">
            {detail}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Btn type="button" variant="secondary" onClick={() => ref.current?.close()}>
            Cancel
          </Btn>
          <Btn type="button" variant={danger ? "danger" : "primary"} onClick={() => ref.current?.close("yes")}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </dialog>
  );
}

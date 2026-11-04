"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Input } from "./controls";

export function PasswordField({ label, ...input }: { label: string } & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  // Back to dots on submit, so browsers don't remember the password as ordinary text.
  useEffect(() => {
    const form = ref.current?.form;
    const hide = () => setVisible(false);
    form?.addEventListener("submit", hide);
    return () => form?.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        {/* While shown it is a text input, so keep spell check and auto-correct away from it. Edge's own eye is hidden. */}
        <Input
          {...input}
          id={id}
          ref={ref}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full pr-12 font-normal [&::-ms-reveal]:hidden"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 transition-colors duration-150 hover:text-ink-900"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {visible ? (
              <>
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                <path d="m2 2 20 20" />
              </>
            ) : (
              <>
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

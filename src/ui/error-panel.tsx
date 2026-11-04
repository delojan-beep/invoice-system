"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Btn } from "./controls";

/** The body of an error page: what happened, how to recover, and a reference for the admin. */
export function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <>
      <p className="text-base text-ink-600">This page couldn&apos;t load. Try again, and contact the admin if it keeps happening.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="button" onClick={() => retry()}>
          Try again
        </Btn>
        <Link href="/" className="inline-flex min-h-11 items-center text-base font-medium text-brand-700 hover:underline">
          Go to my home page
        </Link>
      </div>
      {digest && <p className="text-sm text-ink-600">Reference: {digest}</p>}
    </>
  );
}

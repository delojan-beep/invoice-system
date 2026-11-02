"use client";

import { useRef, useState } from "react";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, attachmentPath } from "@/src/domain/invoice";
import { createClient } from "@/src/supabase/browser";
import { Message } from "@/src/ui/controls";
import type { FormState } from "./actions";

type AttachmentInput = { path: string; fileName: string; mimeType: string; size: number };

/**
 * Uploads a receipt straight from the browser to private Storage, then asks
 * the server to record it against the line. Storage policies only accept
 * files in the employee's own folder for an editable invoice.
 */
export function Uploader({
  employeeId,
  invoiceId,
  record,
}: {
  employeeId: string;
  invoiceId: string;
  record: (file: AttachmentInput) => Promise<FormState>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(file: File) {
    setError(undefined);
    if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      return setError("Attach a PDF, JPG or PNG.");
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return setError("That file is over 10 MB.");
    }

    setBusy(true);
    try {
      const path = attachmentPath(employeeId, invoiceId, file.name, crypto.randomUUID());
      const { error: uploadError } = await createClient()
        .storage.from("attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return setError("The upload failed. Check your connection and try again.");

      const result = await record({ path, fileName: file.name, mimeType: file.type, size: file.size });
      if (result.error) setError(result.error);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
        {busy ? "Uploading…" : "Attach receipt"}
        <input
          ref={input}
          type="file"
          accept={ATTACHMENT_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <Message error={error} />
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";
import { MFA_ERRORS } from "./errors";

const verifySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export type VerifyState = { error?: string };

// Used both to finish enrolment and to verify at sign-in; on success the
// session is upgraded to aal2. Errors come back to the form instead of
// reloading the page, so a QR code that was already scanned stays valid.
export async function verifyTotp(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  await requireActiveViewer();

  const parsed = verifySchema.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!parsed.success) return { error: MFA_ERRORS.format };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { error: MFA_ERRORS.code };

  redirect("/");
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveViewer } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";

const verifySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

// Used both to finish enrolment and to verify at sign-in; on success the
// session is upgraded to aal2.
export async function verifyTotp(formData: FormData) {
  await requireActiveViewer();
  const back = formData.get("from") === "enroll" ? "/mfa/enroll" : "/mfa/verify";

  const parsed = verifySchema.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!parsed.success) redirect(`${back}?error=format`);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) redirect(`${back}?error=code`);

  redirect("/");
}

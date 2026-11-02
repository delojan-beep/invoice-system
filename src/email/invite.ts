import "server-only";
import { googleSignInEnabled } from "@/src/env";
import { appUrl } from "@/src/jobs/data";
import { createAdminClient } from "@/src/supabase/admin";
import { sendAndLog } from "./notify";
import { invitation } from "./templates";

/**
 * Emails a new person a one-time sign-in link. The link is never logged: the
 * notification log keeps the subject and delivery result only.
 */
export async function sendInvitation(person: { name: string; email: string }) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: person.email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    console.error("Invitation: could not create the sign-in link", error);
    return "failed";
  }

  const link = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(token)}&type=magiclink`);
  return sendAndLog("invitation", {
    to: person.email,
    ...invitation({ name: person.name, link, signInLink: appUrl("/login"), google: googleSignInEnabled() }),
  });
}

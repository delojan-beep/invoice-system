import { redirect } from "next/navigation";
import { requireActiveViewer } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";
import { AuthCard } from "@/src/ui/auth-card";
import { CodeForm } from "../code-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function VerifyPage() {
  const viewer = await requireActiveViewer();
  if (viewer.aal === "aal2") redirect("/");

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) redirect("/mfa/enroll");

  return (
    <AuthCard title="Enter your two-factor code">
      <p className="text-sm text-zinc-600">Open your authenticator app and enter the 6-digit code for QNetwork Invoices.</p>
      <CodeForm factorId={factor.id} submitLabel="Verify" />
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-sm text-zinc-600 hover:underline">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}

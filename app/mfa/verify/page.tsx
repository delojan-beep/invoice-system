import { redirect } from "next/navigation";
import { requireActiveViewer } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";
import { AuthCard, Button, Field, Notice } from "@/src/ui/auth-card";
import { verifyTotp } from "../actions";
import { MFA_ERRORS } from "../errors";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await requireActiveViewer();
  if (viewer.aal === "aal2") redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) redirect("/mfa/enroll");

  return (
    <AuthCard title="Enter your two-factor code">
      <p className="text-sm text-zinc-600">Open your authenticator app and enter the 6-digit code for QNetwork Invoices.</p>
      {error && MFA_ERRORS[error] && <Notice tone="error">{MFA_ERRORS[error]}</Notice>}
      <form action={verifyTotp} className="flex flex-col gap-4">
        <input type="hidden" name="factorId" value={factor.id} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
        />
        <Button type="submit">Verify</Button>
      </form>
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-sm text-zinc-600 hover:underline">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}

import { redirect } from "next/navigation";
import { requireActiveViewer } from "@/src/auth/dal";
import { needsTwoFactor } from "@/src/auth/access";
import { createClient } from "@/src/supabase/server";
import { AuthCard, Notice } from "@/src/ui/auth-card";
import { CodeForm } from "../code-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function EnrollPage() {
  const viewer = await requireActiveViewer();
  if (!needsTwoFactor(viewer.roles) || viewer.hasVerifiedFactor) redirect("/");

  const supabase = await createClient();

  // Clear half-finished enrolments so each visit starts with one fresh QR code.
  // A wrong code is reported by the form without reloading, so it keeps this one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data: enrolment, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "QNetwork Invoices",
    friendlyName: `Authenticator ${new Date().toISOString()}`,
  });

  return (
    <AuthCard title="Set up two-factor sign-in">
      <p className="text-sm text-zinc-600">
        Your role can see everyone&apos;s invoices, so it needs a second step at sign-in. Scan this code with an
        authenticator app (Google Authenticator, 1Password, Microsoft Authenticator), then enter the 6-digit code.
      </p>
      {enrollError || !enrolment ? (
        <Notice tone="error">Two-factor setup is unavailable right now. Try again in a minute.</Notice>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL from Supabase */}
          <img src={enrolment.totp.qr_code} alt="QR code for your authenticator app" className="mx-auto h-48 w-48" />
          <p className="break-all text-center font-mono text-xs text-zinc-500">{enrolment.totp.secret}</p>
          <CodeForm factorId={enrolment.id} submitLabel="Turn on two-factor" />
        </>
      )}
    </AuthCard>
  );
}

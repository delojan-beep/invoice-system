import Link from "next/link";
import { requirePasswordPageAccess } from "@/src/auth/dal";
import { AuthCard } from "@/src/ui/auth-card";
import { PasswordForm } from "./password-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function SetPasswordPage() {
  const viewer = await requirePasswordPageAccess();

  return (
    <AuthCard title={viewer.needsPassword ? "Set up your password" : "Change your password"}>
      <p className="text-base text-ink-600">
        {viewer.needsPassword
          ? "You're signed in. Choose a password so you can sign in without an email link next time."
          : `Choose a new password for ${viewer.email}.`}
      </p>
      <PasswordForm />
      {!viewer.needsPassword && (
        <Link href="/" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
          Cancel
        </Link>
      )}
    </AuthCard>
  );
}

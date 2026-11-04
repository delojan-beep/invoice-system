import { CheckedForm } from "@/src/ui/checked-form";
import Link from "next/link";
import { googleSignInEnabled } from "@/src/env";
import { sendEmailLink, signInWithGoogle } from "./actions";
import { GoogleButton } from "./google-button";
import { PasswordForm } from "./password-form";
import { AuthCard, Button, Field, Notice } from "@/src/ui/auth-card";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const ERRORS: Record<string, string> = {
  invalid: "Enter a valid email address and password.",
  link: "That sign-in link has expired or was already used. Request a new one.",
  google: "That Google account can't sign in here. Use the address your admin added, or ask them to add you.",
  "google-failed": "Google sign-in didn't finish. Try again, or sign in with your password or an email link.",
  inactive: "Your account is inactive. Contact the admin if you need access.",
  unavailable: "Sign-in links can't be sent right now. Try again in a few minutes, or use your password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; sent?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "link" ? "link" : "password";
  const errorKey = params.error ?? params.reason;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  const google = googleSignInEnabled() && !params.sent && (
    <>
      <form action={signInWithGoogle}>
        <GoogleButton />
      </form>
      <div className="flex items-center gap-3 text-sm text-ink-600">
        <span className="h-px flex-1 bg-ink-200" />
        or
        <span className="h-px flex-1 bg-ink-200" />
      </div>
    </>
  );

  return (
    <AuthCard title="Sign in">
      {mode === "password" ? (
        <PasswordForm earlierError={error}>{google}</PasswordForm>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          {google}
          {params.sent ? (
            <div className="flex flex-col gap-4">
              <Notice tone="info">
                If that address belongs to an account, a sign-in link is on its way. It works once and expires in 24
                hours.
              </Notice>
              <Link href="/login" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
                Back to password sign-in
              </Link>
            </div>
          ) : (
            <CheckedForm action={sendEmailLink} className="flex flex-col gap-4">
              <Field label="Email" name="email" type="email" autoComplete="email" required />
              <Button type="submit">Email me a link</Button>
              <Link href="/login" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
                Sign in with a password instead
              </Link>
            </CheckedForm>
          )}
        </>
      )}
    </AuthCard>
  );
}

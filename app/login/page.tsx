import Link from "next/link";
import { sendEmailLink, signInWithPassword } from "./actions";
import { AuthCard, Button, Field, Notice } from "@/src/ui/auth-card";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

const ERRORS: Record<string, string> = {
  invalid: "Enter a valid email address and password.",
  credentials: "That email and password don't match. Try again or use an email link.",
  link: "That sign-in link has expired or was already used. Request a new one.",
  inactive: "Your account is inactive. Contact the admin if you need access.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; sent?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "link" ? "link" : "password";
  const error = params.error ?? params.reason;

  return (
    <AuthCard title="Sign in to QNetwork Invoices">
      {error && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}

      {mode === "password" ? (
        <form action={signInWithPassword} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <Button type="submit">Sign in</Button>
          <Link href="/login?mode=link" className="text-sm text-blue-700 hover:underline">
            Email me a sign-in link instead
          </Link>
        </form>
      ) : params.sent ? (
        <div className="flex flex-col gap-4">
          <Notice tone="info">
            If that address belongs to an account, a sign-in link is on its way. It works once and expires in an
            hour.
          </Notice>
          <Link href="/login" className="text-sm text-blue-700 hover:underline">
            Back to password sign-in
          </Link>
        </div>
      ) : (
        <form action={sendEmailLink} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Button type="submit">Email me a link</Button>
          <Link href="/login" className="text-sm text-blue-700 hover:underline">
            Sign in with a password instead
          </Link>
        </form>
      )}
    </AuthCard>
  );
}

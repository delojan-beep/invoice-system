/** What Supabase reports when a password sign-in fails. */
type SignInError = { code?: string; status?: number; message?: string };

/**
 * The sign-in message for a failed attempt. Only a real credentials failure blames the
 * password; an outage otherwise sends people to reset a password that was fine.
 */
export function signInErrorMessage(error: SignInError): string {
  if (error.code === "invalid_credentials" || error.message === "Invalid login credentials") {
    return "That email and password don't match. Try again or use an email link.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many sign-in attempts. Wait a few minutes, then try again.";
  }
  if (error.code === "user_banned") {
    return "Your account is inactive. Contact the admin if you need access.";
  }
  if (error.code === "email_not_confirmed") {
    return "Confirm your email first, using the link in your invitation.";
  }
  return "Sign-in isn't working right now. This isn't your password. Try again in a few minutes.";
}

/**
 * True only when the sign-in service itself failed. Any other refusal must get the usual
 * "on its way" reply, so that the page never reveals whether an address has an account.
 */
export function emailLinkServiceDown(error: SignInError | null): boolean {
  if (!error) return false;
  return !error.status || error.status >= 500;
}

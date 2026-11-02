import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/supabase/server";

// Landing page for email sign-in links. Handles both the PKCE `code` form and
// the `token_hash` form, depending on how the email template builds the link.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = ok ? "/" : "/login";
  if (!ok) target.searchParams.set("error", signInError(searchParams));
  return NextResponse.redirect(target);
}

// Only "signup_disabled" means no one here has that Google address. Anything
// else is a failed sign-in, not a verdict on the person's account.
function signInError(params: URLSearchParams) {
  if (!params.has("error")) return "link";
  const code = params.get("error_code");
  if (code === "signup_disabled") return "google";
  // Only the code is logged: the description can quote Google's one-time code.
  console.error("Google sign-in failed:", params.get("error"), code);
  return "google-failed";
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/src/env";
import { emailLinkServiceDown, signInErrorMessage } from "@/src/auth/sign-in-error";
import { createClient } from "@/src/supabase/server";
import type { FormResult } from "@/src/ui/use-form-action";

const emailSchema = z.email();

export async function signInWithPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (!email.success || typeof password !== "string" || password.length === 0) {
    return { error: "Enter a valid email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) return { error: signInErrorMessage(error) };

  // "/" sends the viewer on to two-factor or their home page.
  redirect("/");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  // Sign-ups are off, so only people an admin has added get through; Supabase
  // joins the Google account to the person with the same email address.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${publicEnv().APP_URL}/auth/confirm`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google-failed");
  redirect(data.url);
}

export async function sendEmailLink(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect("/login?mode=link&error=invalid");

  const supabase = await createClient();
  // shouldCreateUser: false — only people an admin has added can sign in.
  // The reply is the same whether or not the address exists, so it reveals nothing.
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${publicEnv().APP_URL}/auth/confirm` },
  });
  if (emailLinkServiceDown(error)) redirect("/login?mode=link&error=unavailable");

  redirect("/login?mode=link&sent=1");
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/src/env";
import { createClient } from "@/src/supabase/server";

const emailSchema = z.email();

export async function signInWithPassword(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (!email.success || typeof password !== "string" || password.length === 0) {
    redirect("/login?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) redirect("/login?error=credentials");

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
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function sendEmailLink(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect("/login?mode=link&error=invalid");

  const supabase = await createClient();
  // shouldCreateUser: false — only people an admin has added can sign in.
  // The reply is the same whether or not the address exists, so it reveals nothing.
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${publicEnv().APP_URL}/auth/confirm` },
  });

  redirect("/login?mode=link&sent=1");
}

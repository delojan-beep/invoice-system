"use server";

import { redirect } from "next/navigation";
import { requirePasswordPageAccess } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";
import type { FormResult } from "@/src/ui/use-form-action";

export async function setPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requirePasswordPageAccess();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { field: "password", error: "Use at least 10 characters, with both letters and numbers." };
  }
  if (password !== confirm) return { field: "confirm", error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });

  if (error?.code === "same_password") {
    // They already know this password, so there is nothing left to set up.
    await supabase.auth.updateUser({ data: { password_set: true } });
  } else if (error?.code === "weak_password") {
    return { field: "password", error: error.message };
  } else if (error) {
    return { error: "Your password could not be saved. Please try again." };
  }

  // The access token still says "password not set" until it is renewed.
  await supabase.auth.refreshSession();
  redirect("/");
}

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  APP_URL: z.url(),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

// Read lazily so builds and tests do not need every variable set.
export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_URL: process.env.APP_URL,
  });
}

// On only once the Google provider is set up in Supabase; otherwise the button would lead to an error page.
export function googleSignInEnabled() {
  return process.env.GOOGLE_SIGN_IN === "on";
}

export function serverEnv() {
  return serverSchema.parse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}

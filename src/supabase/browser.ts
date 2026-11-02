"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Used only for uploading attachments straight to Storage, so large files
// never pass through a server action (1 MB limit) or Vercel (4.5 MB limit).
// Storage policies check the signed-in user, folder and invoice status.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

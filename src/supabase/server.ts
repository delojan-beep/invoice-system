import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/src/env";
import type { Database } from "./database.types";

// Header values must be plain ASCII; anything else would make fetch throw.
function headerSafe(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, max);
}

// Supabase client acting as the signed-in user, for Server Components and Server Actions.
export async function createClient() {
  // Stop prerendering here: the client reads the clock (token expiry) and
  // everything it returns belongs to one request's user.
  await connection();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const env = publicEnv();

  // The audit trail records the browser's IP and user agent, not this server's.
  // On Vercel the first x-forwarded-for entry is the client.
  const clientIp = headerSafe(requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(), 64);
  const clientAgent = headerSafe(requestHeaders.get("user-agent"), 512);

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        ...(clientIp && { "x-client-ip": clientIp }),
        ...(clientAgent && { "x-client-agent": clientAgent }),
      },
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

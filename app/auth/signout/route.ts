import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  if (request.nextUrl.searchParams.get("reason") === "inactive") target.searchParams.set("reason", "inactive");
  return NextResponse.redirect(target, { status: 303 });
}

// GET is used by the access check to sign out inactive users; POST by the sign-out button.
export const GET = signOut;
export const POST = signOut;

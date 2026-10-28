import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/src/auth/access";
import { getViewer } from "@/src/auth/dal";
import { createClient } from "@/src/supabase/server";

// Opens a receipt through a short-lived signed link. Row-level security and
// storage policies decide who may see it: the owner, and staff with two-factor.
export async function GET(request: NextRequest, { params }: RouteContext<"/attachments/[id]">) {
  const viewer = await getViewer();
  // Signed out or mid-way through two-factor: "/" sends them to the right step.
  if (decideAccess(viewer) !== "ok") return NextResponse.redirect(new URL("/", request.url));

  const { id } = await params;
  const supabase = await createClient();
  const { data: attachment } = await supabase.from("attachments").select("storage_path").eq("id", id).maybeSingle();
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(attachment.storage_path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}

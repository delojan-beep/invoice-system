import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/src/auth/access";
import { getViewer } from "@/src/auth/dal";
import { loadInvoicePdfData } from "@/src/pdf/invoice-data";
import { renderInvoicePdf } from "@/src/pdf/invoice-pdf";
import { createClient } from "@/src/supabase/server";

// Invoice PDF download. Row-level security decides who sees it: the employee
// who owns it, and staff with two-factor.
export async function GET(request: NextRequest, { params }: RouteContext<"/pdf/[id]">) {
  const viewer = await getViewer();
  // Signed out or mid-way through two-factor: "/" sends them to the right step.
  if (decideAccess(viewer) !== "ok") return NextResponse.redirect(new URL("/", request.url));

  const { id } = await params;
  const supabase = await createClient();
  const data = await loadInvoicePdfData(supabase, id, viewer.timezone);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(data);
  const filename = `${data.invoice.number ?? `draft-${data.invoice.month.replace(" ", "-")}`}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

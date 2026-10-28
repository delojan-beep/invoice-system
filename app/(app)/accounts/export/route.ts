import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/src/auth/access";
import { getViewer } from "@/src/auth/dal";
import { minorToDecimal, toCsv, type Cell } from "@/src/domain/csv";
import { listCurrencies, listInvoices } from "@/src/domain/staff-queries";
import { parseFilters } from "../filters";

// CSV of the invoices on the accounts dashboard, with the same filters.
// Amounts are in each invoice's own currency, plus the base-currency (CAD)
// value at the submission-date rate and the payment details from Wise.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const decision = decideAccess(viewer, ["accounts"]);
  if (decision === "forbidden") return new NextResponse("Forbidden", { status: 403 });
  // Signed out or mid-way through two-factor: "/" sends them to the right step.
  if (decision !== "ok") return NextResponse.redirect(new URL("/", request.url));

  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const [invoices, currencies] = await Promise.all([listInvoices(filters), listCurrencies()]);
  const places = (code: string | null | undefined) => currencies.find((c) => c.code === code)?.decimal_places ?? 2;
  const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

  const header: Cell[] = [
    "Invoice number", "Employee", "Employee code", "Month", "Status", "Currency",
    "Subtotal", "Tax", "Total", "Rate to CAD (submission)", "Total in CAD (expected)",
    "Submitted", "Review deadline", "Approved", "Paid", "Marked paid by",
    "Wise transfer ID", "Amount sent", "Sent currency", "Wise fee", "Fee paid by",
    "Amount received", "Received currency", "Actual rate", "Confirmed by accounts", "Employee reference",
  ];

  const rows = invoices.map((i): Cell[] => {
    const code = i.currency?.code;
    const d = places(code);
    const p = i.payments.at(-1);
    const rate = i.exchange_rate_to_base;
    return [
      i.number, i.employee?.name, i.employee?.employee_code, i.month.slice(0, 7), i.status, code,
      minorToDecimal(i.subtotal_minor, d), minorToDecimal(i.tax_total_minor, d), minorToDecimal(i.total_minor, d),
      rate ?? "", rate ? ((i.total_minor / 10 ** d) * rate).toFixed(places("CAD")) : "",
      date(i.submitted_at), date(i.review_deadline), date(i.approved_at), date(i.paid_at), i.marked_paid_by ?? "",
      p?.wise_transfer_id ?? "", minorToDecimal(p?.amount_sent_minor, places(p?.sent_currency)), p?.sent_currency ?? "",
      minorToDecimal(p?.wise_fee_minor, places(p?.sent_currency)), p?.fee_paid_by ?? "",
      minorToDecimal(p?.amount_received_minor, places(p?.received_currency)), p?.received_currency ?? "",
      p?.actual_exchange_rate ?? "", date(p?.confirmed_by_accounts_at ?? null), i.employee_reference ?? "",
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qnetwork-invoices-${filters.month ?? stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

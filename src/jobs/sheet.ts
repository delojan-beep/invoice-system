import "server-only";
import { createSign } from "node:crypto";
import { minorToDecimal } from "@/src/domain/csv";
import { createAdminClient } from "@/src/supabase/admin";

// Google Sheet backup: each approved invoice is appended to the sheet once,
// so the old sheet stays a read-only copy while the app is rolled out.
// Needs GOOGLE_SA_JSON (a service account key, as JSON) and BACKUP_SHEET_ID,
// with the sheet shared with the service account's email as an editor.

type ServiceAccount = { client_email: string; private_key: string };

/** A signed JWT asking Google for a Sheets token (OAuth service-account flow). */
export function serviceAccountJwt(sa: ServiceAccount, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function accessToken(sa: ServiceAccount, now: Date) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountJwt(sa, now),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? res.status}`);
  return body.access_token;
}

export const SHEET_HEADER = [
  "Invoice number", "Employee", "Employee code", "Month", "Currency",
  "Subtotal", "Tax", "Total", "Submitted", "Approved", "Exported",
];

type SheetInvoice = {
  number: string | null;
  month: string;
  currency_code: string;
  subtotal_minor: number;
  tax_total_minor: number;
  total_minor: number;
  submitted_at: string | null;
  approved_at: string | null;
  currency: { decimal_places: number } | null;
  employee: { name: string; employee_code: string | null } | null;
};

/** One sheet row per invoice. Values are written as plain text/numbers, never formulas. */
export function toSheetRow(i: SheetInvoice, exportedAt: Date): (string | number)[] {
  const places = i.currency?.decimal_places ?? 2;
  return [
    i.number ?? "",
    i.employee?.name ?? "",
    i.employee?.employee_code ?? "",
    i.month.slice(0, 7),
    i.currency_code,
    minorToDecimal(i.subtotal_minor, places),
    minorToDecimal(i.tax_total_minor, places),
    minorToDecimal(i.total_minor, places),
    i.submitted_at?.slice(0, 10) ?? "",
    i.approved_at?.slice(0, 10) ?? "",
    exportedAt.toISOString().slice(0, 10),
  ];
}

export async function exportToSheet(now: Date): Promise<string> {
  const keyJson = process.env.GOOGLE_SA_JSON;
  const sheetId = process.env.BACKUP_SHEET_ID;
  if (!keyJson || !sheetId) return "skipped: Google Sheet backup not set up (GOOGLE_SA_JSON, BACKUP_SHEET_ID)";
  const sa = JSON.parse(keyJson) as ServiceAccount;
  const tab = process.env.BACKUP_SHEET_TAB || "Invoices";

  // Claim the invoices first (set the export time) so overlapping runs never
  // copy the same invoice twice; on failure the claim is undone.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ sheet_exported_at: now.toISOString() })
    .in("status", ["approved", "paid"])
    .is("sheet_exported_at", null)
    .select(
      `id, number, month, currency_code, subtotal_minor, tax_total_minor, total_minor, submitted_at, approved_at,
       currency:currencies(decimal_places), employee:profiles!invoices_employee_id_fkey(name, employee_code)`,
    );
  if (error) throw error;
  if (data.length === 0) return "nothing new";

  try {
    const token = await accessToken(sa, now);
    const range = encodeURIComponent(`${tab}!A1`);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: data.sort((a, b) => (a.number ?? "").localeCompare(b.number ?? "")).map((i) => toSheetRow(i, now)) }),
      },
    );
    if (!res.ok) throw new Error(`Google Sheets returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    await supabase.from("invoices").update({ sheet_exported_at: null }).in("id", data.map((i) => i.id));
    throw err;
  }
  return `${data.length} invoices copied to the sheet`;
}

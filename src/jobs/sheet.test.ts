import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/src/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { SHEET_HEADER, serviceAccountJwt, toSheetRow } = await import("./sheet");

describe("serviceAccountJwt", () => {
  it("signs a Google service-account token request that verifies with the public key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const now = new Date("2026-10-28T10:00:00Z");
    const jwt = serviceAccountJwt(
      { client_email: "backup@example.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() },
      now,
    );
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iss: "backup@example.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1793181600,
      exp: 1793185200,
    });
    const valid = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url"));
    expect(valid).toBe(true);
  });
});

describe("toSheetRow", () => {
  it("lines up with the header, amounts as plain decimals", () => {
    const row = toSheetRow(
      {
        number: "QN-E014-2026-10-001",
        month: "2026-10-01",
        currency_code: "LKR",
        subtotal_minor: 25000000,
        tax_total_minor: 0,
        total_minor: 25000000,
        submitted_at: "2026-10-28T09:00:00Z",
        approved_at: "2026-10-29T13:00:00Z",
        currency: { decimal_places: 2 },
        employee: { name: "Nimal Perera", employee_code: "E014" },
      },
      new Date("2026-10-29T14:00:00Z"),
    );
    expect(row).toHaveLength(SHEET_HEADER.length);
    expect(row).toEqual([
      "QN-E014-2026-10-001", "Nimal Perera", "E014", "2026-10", "LKR",
      "250000.00", "0.00", "250000.00", "2026-10-28", "2026-10-29", "2026-10-29",
    ]);
  });
});

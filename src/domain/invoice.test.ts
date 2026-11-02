import { describe, expect, it } from "vitest";
import { allowedActions, attachmentPath, invoiceTotals, isEditable, isOverdue, lineAmounts } from "./invoice";

describe("lineAmounts (same results as the database)", () => {
  it("rounds quantity x rate half-up to whole minor units", () => {
    expect(lineAmounts(2.5, 1999, null)).toEqual({ lineTotalMinor: 4998, taxMinor: 0 });
    expect(lineAmounts(1, 25000000, null)).toEqual({ lineTotalMinor: 25000000, taxMinor: 0 });
  });

  it("avoids floating-point error on part quantities", () => {
    // 0.285 x 1000 is 284.99999... in floating point
    expect(lineAmounts(0.285, 1000, null).lineTotalMinor).toBe(285);
    expect(lineAmounts(0.125, 3, null).lineTotalMinor).toBe(0); // 0.375 rounds down
    expect(lineAmounts(0.5, 1, null).lineTotalMinor).toBe(1); // 0.5 rounds up
  });

  it("calculates tax per line from the line total", () => {
    expect(lineAmounts(1, 10000, 18)).toEqual({ lineTotalMinor: 10000, taxMinor: 1800 });
    expect(lineAmounts(1, 1999, 13)).toEqual({ lineTotalMinor: 1999, taxMinor: 260 }); // 259.87
    expect(lineAmounts(1, 1999, 5)).toEqual({ lineTotalMinor: 1999, taxMinor: 100 }); // 99.95
  });
});

describe("invoiceTotals", () => {
  it("adds lines into subtotal, tax and total", () => {
    const lines = [lineAmounts(1, 25000000, null), lineAmounts(2.5, 1999, null), lineAmounts(1, 10000, 18)];
    expect(invoiceTotals(lines)).toEqual({ subtotalMinor: 25014998, taxTotalMinor: 1800, totalMinor: 25016798 });
  });
});

describe("status rules", () => {
  it("lets employees edit drafts and rejected invoices only", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("rejected")).toBe(true);
    expect(isEditable("submitted")).toBe(false);
    expect(isEditable("paid")).toBe(false);
  });

  it("marks submitted invoices past their review deadline as overdue", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    expect(isOverdue({ status: "submitted", review_deadline: "2026-10-25T09:00:00Z" }, now)).toBe(true);
    expect(isOverdue({ status: "submitted", review_deadline: "2026-10-27T09:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ status: "approved", review_deadline: "2026-10-25T09:00:00Z" }, now)).toBe(false);
  });
});

describe("allowedActions", () => {
  const base = { review_started_at: null, isOwner: false, isApprover: false };

  it("owner: edit and submit a draft, recall until review starts, mark paid once approved", () => {
    expect(allowedActions({ ...base, status: "draft", isOwner: true })).toEqual(["edit", "submit"]);
    expect(allowedActions({ ...base, status: "submitted", isOwner: true })).toEqual(["recall"]);
    expect(allowedActions({ ...base, status: "submitted", isOwner: true, review_started_at: "2026-10-20" })).toEqual([]);
    expect(allowedActions({ ...base, status: "approved", isOwner: true })).toEqual(["mark_paid"]);
    expect(allowedActions({ ...base, status: "paid", isOwner: true })).toEqual([]);
  });

  it("approver: approve or reject submitted invoices, mark approved ones paid", () => {
    expect(allowedActions({ ...base, status: "submitted", isApprover: true })).toEqual(["approve", "reject"]);
    expect(allowedActions({ ...base, status: "approved", isApprover: true })).toEqual(["mark_paid"]);
    expect(allowedActions({ ...base, status: "draft", isApprover: true })).toEqual([]);
  });

  it("anyone else: nothing", () => {
    expect(allowedActions({ ...base, status: "submitted" })).toEqual([]);
  });
});

describe("attachmentPath", () => {
  it("files attachments under employee/invoice with a safe name", () => {
    expect(attachmentPath("emp", "inv", "Taxi receipt (Oct).pdf", "abc")).toBe("emp/inv/abc-Taxi_receipt_Oct_.pdf");
  });
});

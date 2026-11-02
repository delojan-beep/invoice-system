import { describe, expect, it } from "vitest";
import { dailySummary, escapeHtml, invitation, monthlySummary, statusUpdate, withNote, type InvoiceRow } from "./templates";

const row = (over: Partial<InvoiceRow> = {}): InvoiceRow => ({
  employee: "Nimal Perera",
  number: "QN-E014-2026-10-001",
  month: "October 2026",
  total: "Rs 250,000.00",
  currency: "LKR",
  status: "Submitted",
  date: "Nov 7, 2026",
  link: "http://localhost:3000/invoices/abc",
  ...over,
});

describe("invitation", () => {
  const input = { name: "<Nimal>", link: "http://localhost:3000/auth/confirm?token_hash=abc&type=magiclink", signInLink: "http://localhost:3000/login" };

  it("carries the link and escapes the name", () => {
    const mail = invitation({ ...input, google: false });
    expect(mail.html).toContain("token_hash=abc&amp;type=magiclink");
    expect(mail.text).toContain(input.link);
    expect(mail.html).toContain("&lt;Nimal&gt;");
    expect(mail.html).not.toContain("Continue with Google");
  });

  it("mentions Google only when it is on", () => {
    expect(invitation({ ...input, google: true }).html).toContain("Continue with Google");
    expect(invitation({ ...input, google: true }).text).toContain("Continue with Google");
  });
});

describe("escapeHtml", () => {
  it("escapes markup", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">&'`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;");
  });
});

describe("statusUpdate", () => {
  it("quotes the CEO's rejection comment, escaped", () => {
    const email = statusUpdate({
      employeeName: "Nimal",
      month: "October 2026",
      number: "QN-E014-2026-10-001",
      total: "Rs 250,000.00",
      event: "rejected",
      comment: "Add <b>receipts</b>",
      link: "http://x/employee/invoices/1",
    });
    expect(email.subject).toBe("Changes needed: your October 2026 invoice");
    expect(email.html).toContain("Add &lt;b&gt;receipts&lt;/b&gt;");
    expect(email.html).not.toContain("<b>receipts</b>");
    expect(email.text).toContain('"Add <b>receipts</b>"');
  });

  it("names approval and payment", () => {
    const base = { employeeName: "N", month: "October 2026", number: "N1", total: "$ 1.00", link: "l" };
    expect(statusUpdate({ ...base, event: "approved" }).subject).toBe("Approved: your October 2026 invoice");
    expect(statusUpdate({ ...base, event: "paid" }).subject).toBe("Paid: your October 2026 invoice");
  });
});

describe("dailySummary", () => {
  it("puts overdue first, then waiting, then approved, and leads the subject with overdue", () => {
    const email = dailySummary({
      recipientName: "Casey",
      overdue: [row({ employee: "Late One", status: "Overdue" })],
      waiting: [row({ employee: "Waiting Two" })],
      toPay: [row({ employee: "Approved Three", status: "Approved" })],
      fields: ["number", "date", "total"],
      link: "http://x/approver",
    });
    expect(email.subject).toBe("1 overdue · 3 invoices not yet paid");
    const html = email.html;
    expect(html.indexOf("Late One")).toBeLessThan(html.indexOf("Waiting Two"));
    expect(html.indexOf("Waiting Two")).toBeLessThan(html.indexOf("Approved Three"));
  });

  it("shows only the fields chosen in settings", () => {
    const email = dailySummary({ recipientName: "C", overdue: [], waiting: [row()], toPay: [], fields: ["number"], link: "l" });
    expect(email.html).toContain("QN-E014-2026-10-001");
    expect(email.html).not.toContain("Rs 250,000.00");
    expect(email.subject).toBe("1 invoice not yet paid");
  });
});

describe("withNote", () => {
  const base = statusUpdate({ employeeName: "N", month: "October 2026", number: "N1", total: "$ 1.00", event: "approved", link: "l" });

  it("adds the admin's note under the heading, escaped, and at the top of the text", () => {
    const email = withNote(base, "Payday is the 25th <b>sharp</b>");
    expect(email.html).toMatch(/<\/h1>\n<p[^>]*>Payday is the 25th &lt;b&gt;sharp&lt;\/b&gt;<\/p>/);
    expect(email.text.startsWith("Payday is the 25th <b>sharp</b>\n\n")).toBe(true);
    expect(email.subject).toBe(base.subject);
  });

  it("changes nothing when there is no note", () => {
    expect(withNote(base, "")).toEqual(base);
    expect(withNote(base, undefined)).toEqual(base);
  });
});

describe("monthlySummary", () => {
  it("highlights invoices still waiting for approval or payment", () => {
    const email = monthlySummary({
      recipientName: "Alex",
      month: "October 2026",
      rows: [row({ status: "Paid" }), row({ number: "QN-E015-2026-10-001", status: "Approved" })],
      link: "l",
    });
    expect(email.subject).toBe("Monthly invoice summary: October 2026");
    expect(email.html).toContain("1 still waiting for approval or payment.");
  });
});

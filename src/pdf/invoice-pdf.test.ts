import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfSafe, renderInvoicePdf, wrap, type InvoicePdfData } from "./invoice-pdf";

const data = (lines = 2): InvoicePdfData => ({
  company: { name: "QNetwork", businessNumber: "123456789RC0001", address: "1 King St W\nToronto ON" },
  worker: { name: "Nimal Perera", code: "E014", address: "12 Galle Road, Colombo 03", nicOrTin: "199012345678" },
  invoice: { number: "QN-E014-2026-10-001", month: "October 2026", status: "Submitted", submitted: "Oct 28, 2026", currency: "LKR", reference: null },
  lines: Array.from({ length: lines }, (_, i) => ({
    type: "Professional fees",
    description: `Line ${i + 1}: monthly services with a fairly long description that has to wrap onto another line`,
    quantity: "1",
    rate: "Rs 250,000.00",
    tax: "—",
    amount: "Rs 250,000.00",
  })),
  totals: { subtotal: "Rs 500,000.00", taxes: [], total: "Rs 500,000.00" },
});

describe("renderInvoicePdf", () => {
  it("produces a one-page PDF for a normal invoice", async () => {
    const bytes = await renderInvoicePdf(data());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Invoice QN-E014-2026-10-001");
  });

  it("continues onto more pages for long invoices", async () => {
    const doc = await PDFDocument.load(await renderInvoicePdf(data(40)));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("does not fail on names in other scripts", async () => {
    const d = data();
    d.worker.name = "නිමල් පෙරේරා";
    await expect(renderInvoicePdf(d)).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("pdfSafe and wrap", () => {
  it("replaces characters the standard font cannot draw", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(pdfSafe("Café ගම", font)).toBe("Café ??");
  });

  it("wraps text to a width and cuts words longer than a line", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrap("one two three four five six seven eight nine ten", font, 10, 60);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(60);
    const long = wrap("x".repeat(200), font, 10, 50);
    for (const l of long) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(50);
  });
});

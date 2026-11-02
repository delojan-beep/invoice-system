import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// The invoice PDF. Sri Lankan banks ask for these details before accepting a
// payment from abroad: QNetwork's Business Number and address, the worker's
// name, address and NIC/TIN, and the invoice with its lines and totals.

export type InvoicePdfData = {
  company: { name: string; businessNumber: string; address: string };
  worker: { name: string; code: string | null; address: string | null; nicOrTin: string | null };
  invoice: {
    number: string | null;
    month: string; // "October 2026"
    status: string; // "Draft", "Submitted", ...
    submitted: string | null; // formatted date
    currency: string; // "LKR"
    reference: string | null;
  };
  lines: { type: string; description: string; quantity: string; rate: string; tax: string; amount: string }[];
  totals: { subtotal: string; taxes: { label: string; amount: string }[]; total: string };
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.44, 0.44, 0.48);
const RULE = rgb(0.85, 0.85, 0.87);

/**
 * The standard PDF fonts only cover Latin text (WinAnsi). Characters they
 * cannot draw (e.g. Sinhala or Tamil script) become "?" instead of failing.
 */
export function pdfSafe(text: string, font: PDFFont) {
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Splits text into lines no wider than `width` (and on the text's own line breaks). */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // A single word longer than the column is cut into pieces.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Invoice ${data.invoice.number ?? "draft"}`);
  doc.setCreator("QNetwork Invoices");
  doc.setProducer("QNetwork Invoices");

  let page: PDFPage = doc.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  const right = A4.width - MARGIN;

  const text = (s: string, x: number, size = 10, font = regular, color = INK) =>
    page.drawText(pdfSafe(s, font), { x, y, size, font, color });
  const textRight = (s: string, xRight: number, size = 10, font = regular, color = INK) => {
    const safe = pdfSafe(s, font);
    page.drawText(safe, { x: xRight - font.widthOfTextAtSize(safe, size), y, size, font, color });
  };
  const block = (lines: string[], x: number, width: number, size = 10) => {
    for (const raw of lines) {
      for (const l of wrap(pdfSafe(raw, regular), regular, size, width)) {
        text(l, x, size);
        y -= size + 4;
      }
    }
  };
  const rule = () => page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.75, color: RULE });

  // Heading
  text("INVOICE", MARGIN, 22, bold);
  textRight(data.invoice.number ?? "Number assigned on submission", right, 11, bold);
  y -= 16;
  if (data.invoice.status !== "Submitted" && data.invoice.status !== "Approved" && data.invoice.status !== "Paid") {
    textRight(data.invoice.status.toUpperCase(), right, 9, bold, MUTED);
  }
  y -= 22;

  // From (the worker) and Bill to (QNetwork), side by side.
  const colWidth = (right - MARGIN - 24) / 2;
  const topY = y;
  text("FROM", MARGIN, 8, bold, MUTED);
  y -= 14;
  text(data.worker.name + (data.worker.code ? ` (${data.worker.code})` : ""), MARGIN, 11, bold);
  y -= 15;
  block([data.worker.address ?? "Address not on file", data.worker.nicOrTin ? `NIC / TIN: ${data.worker.nicOrTin}` : "NIC / TIN not on file"], MARGIN, colWidth);
  const leftBottom = y;

  y = topY;
  const billX = MARGIN + colWidth + 24;
  text("BILL TO", billX, 8, bold, MUTED);
  y -= 14;
  text(data.company.name, billX, 11, bold);
  y -= 15;
  block(
    [data.company.address || "Company address not set", data.company.businessNumber ? `Business Number (BN): ${data.company.businessNumber}` : "Business Number not set"],
    billX,
    colWidth,
  );
  y = Math.min(y, leftBottom) - 12;

  // Invoice facts
  const facts: [string, string][] = [
    ["Invoice month", data.invoice.month],
    ["Currency", data.invoice.currency],
    ["Submitted", data.invoice.submitted ?? "Not yet submitted"],
    ...(data.invoice.reference ? ([["Reference", data.invoice.reference]] as [string, string][]) : []),
  ];
  for (const [label, value] of facts) {
    text(label, MARGIN, 9, regular, MUTED);
    text(value, MARGIN + 100, 10);
    y -= 15;
  }
  y -= 12;

  // Lines table. Number columns are right-aligned at these x positions,
  // wide enough for amounts like "Rs 12,345,678.90".
  const cols = { desc: MARGIN, qty: 300, rate: 405, tax: 445, amount: right };
  const descWidth = cols.qty - 32 - cols.desc;
  const header = () => {
    rule();
    y -= 14;
    text("Description", cols.desc, 9, bold, MUTED);
    textRight("Qty", cols.qty, 9, bold, MUTED);
    textRight("Rate", cols.rate, 9, bold, MUTED);
    textRight("Tax", cols.tax, 9, bold, MUTED);
    textRight("Amount", cols.amount, 9, bold, MUTED);
    y -= 8;
    rule();
    y -= 16;
  };
  header();

  for (const line of data.lines) {
    const descLines = wrap(pdfSafe(line.description, regular), regular, 10, descWidth);
    const needed = (descLines.length + 1) * 14 + 8;
    if (y - needed < MARGIN + 40) {
      page = doc.addPage([A4.width, A4.height]);
      y = A4.height - MARGIN;
      header();
    }
    text(descLines[0] ?? "", cols.desc, 10);
    textRight(line.quantity, cols.qty, 10);
    textRight(line.rate, cols.rate, 10);
    textRight(line.tax, cols.tax, 10);
    textRight(line.amount, cols.amount, 10);
    for (const more of descLines.slice(1)) {
      y -= 14;
      text(more, cols.desc, 10);
    }
    y -= 13;
    text(line.type, cols.desc, 8, regular, MUTED);
    y -= 17;
  }

  // Totals
  if (y < MARGIN + 100) {
    page = doc.addPage([A4.width, A4.height]);
    y = A4.height - MARGIN;
  }
  rule();
  y -= 18;
  // Labels sit right-aligned just left of the widest amount.
  const widest = Math.max(
    bold.widthOfTextAtSize(pdfSafe(data.totals.total, bold), 12),
    ...[data.totals.subtotal, ...data.totals.taxes.map((t) => t.amount)].map((a) => regular.widthOfTextAtSize(pdfSafe(a, regular), 10)),
  );
  const labelRight = right - widest - 20;
  textRight("Subtotal", labelRight, 10, regular, MUTED);
  textRight(data.totals.subtotal, right, 10);
  for (const t of data.totals.taxes) {
    y -= 16;
    textRight(t.label, labelRight, 10, regular, MUTED);
    textRight(t.amount, right, 10);
  }
  y -= 20;
  textRight(`Total (${data.invoice.currency})`, labelRight, 12, bold);
  textRight(data.totals.total, right, 12, bold);

  // Footer on every page
  for (const p of doc.getPages()) {
    p.drawText("Generated by QNetwork Invoices", { x: MARGIN, y: MARGIN / 2, size: 8, font: regular, color: MUTED });
  }

  return doc.save();
}

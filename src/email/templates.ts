// Email wording. Every value that comes from people (names, descriptions,
// comments) is escaped before it goes into HTML.

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

export type InvoiceRow = {
  employee: string;
  number: string;
  month: string; // "October 2026"
  total: string; // formatted, e.g. "Rs 250,000.00"
  currency: string;
  status: string; // "Submitted"
  date: string; // submitted / deadline / approved date, already formatted
  link: string;
};

type Rendered = { subject: string; html: string; text: string };

function layout(heading: string, body: string, footer = "Sent by QNetwork Invoices.") {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px">
<h1 style="margin:0 0 16px;font-size:20px">${e(heading)}</h1>
${body}
</div>
<p style="color:#71717a;font-size:12px;margin:16px 0 0">${e(footer)}</p>
</div></body></html>`;
}

function button(link: string, label: string) {
  return `<p style="margin:20px 0 0"><a href="${e(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">${e(label)}</a></p>`;
}

type Column = { key: keyof InvoiceRow; label: string };

function table(rows: InvoiceRow[], columns: Column[]) {
  const head = columns.map((c) => `<th align="left" style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-size:12px;color:#71717a">${e(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => {
            const value = e(r[c.key]);
            const cell = c.key === "number" ? `<a href="${e(r.link)}" style="color:#1d4ed8">${value}</a>` : value;
            return `<td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:14px">${cell}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px"><tr>${head}</tr>${body}</table>`;
}

function textTable(rows: InvoiceRow[], columns: Column[]) {
  return rows.map((r) => "- " + columns.map((c) => r[c.key]).join(" · ") + `\n  ${r.link}`).join("\n");
}

// --- Employee: status updates ---------------------------------------------

export function statusUpdate(args: {
  employeeName: string;
  month: string;
  number: string;
  total: string;
  event: "approved" | "rejected" | "paid";
  comment?: string | null;
  link: string;
}): Rendered {
  const { employeeName, month, number, total, event, comment, link } = args;
  const what = {
    approved: { subject: `Approved: your ${month} invoice`, line: `Your ${month} invoice (${number}, ${total}) was approved. Payment follows through Wise.` },
    rejected: { subject: `Changes needed: your ${month} invoice`, line: `The CEO sent your ${month} invoice (${number}) back. Fix it and resubmit; the review period restarts when you do.` },
    paid: { subject: `Paid: your ${month} invoice`, line: `The CEO marked your ${month} invoice (${number}, ${total}) as paid in Wise. Check it arrived.` },
  }[event];

  const quote = comment
    ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #f59e0b;background:#fffbeb">${e(comment)}</blockquote>`
    : "";
  return {
    subject: what.subject,
    html: layout(what.subject, `<p>Hi ${e(employeeName)},</p><p>${e(what.line)}</p>${quote}${button(link, "Open the invoice")}`),
    text: `Hi ${employeeName},\n\n${what.line}\n${comment ? `\n"${comment}"\n` : ""}\nOpen the invoice: ${link}\n`,
  };
}

// --- CEO: daily summary -------------------------------------------------------

const SUMMARY_FIELDS: Record<string, Column> = {
  number: { key: "number", label: "Invoice" },
  date: { key: "date", label: "Date" },
  total: { key: "total", label: "Total" },
};

export function dailySummary(args: {
  recipientName: string;
  overdue: InvoiceRow[];
  waiting: InvoiceRow[];
  toPay: InvoiceRow[];
  fields: string[]; // from settings: which fields appear
  link: string;
}): Rendered {
  const { recipientName, overdue, waiting, toPay, link } = args;
  const columns: Column[] = [
    { key: "employee", label: "Employee" },
    ...args.fields.map((f) => SUMMARY_FIELDS[f]).filter(Boolean),
    { key: "status", label: "Status" },
  ];
  const total = overdue.length + waiting.length + toPay.length;
  const subject = overdue.length
    ? `${overdue.length} overdue · ${total} invoice${total === 1 ? "" : "s"} not yet paid`
    : `${total} invoice${total === 1 ? "" : "s"} not yet paid`;

  const sections: [string, InvoiceRow[]][] = [
    ["Overdue for review", overdue],
    ["Waiting for your approval", waiting],
    ["Approved, waiting for payment", toPay],
  ];
  const html = sections
    .filter(([, rows]) => rows.length)
    .map(([title, rows]) => `<h2 style="font-size:15px;margin:16px 0 4px">${e(title)} (${rows.length})</h2>${table(rows, columns)}`)
    .join("");
  const text = sections
    .filter(([, rows]) => rows.length)
    .map(([title, rows]) => `${title} (${rows.length})\n${textTable(rows, columns)}`)
    .join("\n\n");

  return {
    subject,
    html: layout(subject, `<p>Good morning ${e(recipientName)},</p>${html}${button(link, "Open approvals")}`,
      "You get this once a day while any invoice is not yet marked paid."),
    text: `Good morning ${recipientName},\n\n${text}\n\nOpen approvals: ${link}\n`,
  };
}

// --- CEO: review deadline warning --------------------------------------------

export function deadlineWarning(args: { recipientName: string; invoices: InvoiceRow[]; link: string }): Rendered {
  const n = args.invoices.length;
  const subject = `Review due within 24 hours: ${n} invoice${n === 1 ? "" : "s"}`;
  const columns: Column[] = [
    { key: "employee", label: "Employee" },
    { key: "number", label: "Invoice" },
    { key: "total", label: "Total" },
    { key: "date", label: "Review due" },
  ];
  return {
    subject,
    html: layout(subject, `<p>Hi ${e(args.recipientName)},</p><p>These invoices reach their review deadline within 24 hours.</p>${table(args.invoices, columns)}${button(args.link, "Open approvals")}`),
    text: `Hi ${args.recipientName},\n\nThese invoices reach their review deadline within 24 hours:\n${textTable(args.invoices, columns)}\n\nOpen approvals: ${args.link}\n`,
  };
}

// --- Accounts: overdue alert ---------------------------------------------------

export function overdueAlert(args: { recipientName: string; invoices: InvoiceRow[]; link: string }): Rendered {
  const n = args.invoices.length;
  const subject = `Overdue: ${n} invoice${n === 1 ? "" : "s"} passed the review deadline`;
  const columns: Column[] = [
    { key: "employee", label: "Employee" },
    { key: "number", label: "Invoice" },
    { key: "total", label: "Total" },
    { key: "date", label: "Deadline" },
  ];
  return {
    subject,
    html: layout(subject, `<p>Hi ${e(args.recipientName)},</p><p>These invoices passed their review deadline without approval. They now sit at the top of the CEO's daily summary.</p>${table(args.invoices, columns)}${button(args.link, "Open overdue invoices")}`),
    text: `Hi ${args.recipientName},\n\nThese invoices passed their review deadline without approval:\n${textTable(args.invoices, columns)}\n\nOpen overdue invoices: ${args.link}\n`,
  };
}

// --- CEO and accounts: monthly summary ----------------------------------------

export function monthlySummary(args: { recipientName: string; month: string; rows: InvoiceRow[]; link: string }): Rendered {
  const { recipientName, month, rows, link } = args;
  const open = rows.filter((r) => r.status === "Submitted" || r.status === "Approved" || r.status === "Overdue");
  const subject = `Monthly invoice summary: ${month}`;
  const columns: Column[] = [
    { key: "employee", label: "Employee" },
    { key: "number", label: "Invoice" },
    { key: "currency", label: "Currency" },
    { key: "total", label: "Total" },
    { key: "status", label: "Status" },
  ];
  const highlight = open.length
    ? `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px">${open.length} still waiting for approval or payment.</p>${table(open, columns)}<h2 style="font-size:15px;margin:16px 0 4px">All invoices for ${e(month)}</h2>`
    : "";
  return {
    subject,
    html: layout(subject, `<p>Hi ${e(recipientName)},</p>${highlight}${rows.length ? table(rows, columns) : "<p>No invoices submitted for this month yet.</p>"}${button(link, "Open all invoices")}`),
    text: `Hi ${recipientName},\n\n${open.length ? `${open.length} still waiting for approval or payment.\n\n` : ""}All invoices for ${month}:\n${textTable(rows, columns) || "None yet."}\n\nOpen all invoices: ${link}\n`,
  };
}

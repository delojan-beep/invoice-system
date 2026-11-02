import "server-only";

// Delivers one email. Production uses Resend; local development uses the
// Mailpit inbox that `supabase start` runs (http://localhost:54324).

export type Attachment = { filename: string; contentBase64: string; contentType: string };

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
};

type Transport = "resend" | "mailpit" | "log";

function transport(): Transport {
  const chosen = process.env.EMAIL_TRANSPORT as Transport | undefined;
  if (chosen) return chosen;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.MAILPIT_URL) return "mailpit";
  return "log";
}

function from() {
  return process.env.EMAIL_FROM || "QNetwork Invoices <invoices@qnetwork.test>";
}

/** Returns the provider's message id. Throws if the email was not accepted. */
export async function deliver(email: Email): Promise<string> {
  const via = transport();

  // A production app that only logs would silently drop every email.
  if (process.env.NODE_ENV === "production" && via !== "resend") {
    throw new Error("Email is not configured: set RESEND_API_KEY and EMAIL_FROM");
  }

  if (via === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.contentBase64 })),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? "no id returned"}`);
    return body.id;
  }

  if (via === "mailpit") {
    const match = /^(.*)<(.+)>$/.exec(from());
    const res = await fetch(`${process.env.MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: match ? { Name: match[1].trim(), Email: match[2] } : { Email: from() },
        To: [{ Email: email.to }],
        Subject: email.subject,
        HTML: email.html,
        Text: email.text,
        Attachments: email.attachments?.map((a) => ({
          Filename: a.filename,
          Content: a.contentBase64,
          ContentType: a.contentType,
        })),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { ID?: string };
    if (!res.ok || !body.ID) throw new Error(`Mailpit ${res.status}`);
    return body.ID;
  }

  console.info(`[email] to=${email.to} subject=${JSON.stringify(email.subject)}`);
  return `log-${crypto.randomUUID()}`;
}

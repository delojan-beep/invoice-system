# Invoice System

Monthly invoicing: employees submit, the CEO approves, payment is recorded. See `doc/` for the PRD.

Stack: Next.js 16 on Vercel, Supabase (Postgres, Auth with two-factor, Storage), Resend for email.

## Run it locally

Needs Node.js 24, pnpm 9 and Docker Desktop.

```sh
pnpm install
pnpm db:start                 # starts Supabase in Docker; prints the local keys
cp .env.example .env.local    # paste the URL, publishable key and secret key
pnpm db:reset                 # applies migrations, seed.sql, and creates the dev users
pnpm dev                      # http://localhost:3000
```

All local email (sign-in links and every app notification) lands in Mailpit at http://localhost:54324. Supabase Studio is at http://localhost:54323.

### Dev users

All use the password `LocalDev2026`.

| Email | Role |
| --- | --- |
| admin@qnetwork.test | Admin |
| ceo@qnetwork.test | Approver |
| accounts@qnetwork.test | Accounts |
| nimal@qnetwork.test | Employee (E014, LKR) |
| jordan@qnetwork.test | Employee (E015, CAD) |

Approver, accounts and admin must set up an authenticator app on first sign-in.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs the app locally |
| `pnpm test` | Unit tests |
| `pnpm test:db` | Database access-rule tests (needs `pnpm db:start`) |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm build` | Production build |
| `pnpm db:reset` | Rebuilds the local database from migrations and seeds |

## Layout

```
app/              routes: (app)/employee, approver, accounts, admin; login; mfa; auth
src/auth/         access rules (access.ts) and the per-request check (dal.ts)
src/supabase/     Supabase clients for server code, admin tasks and proxy.ts
src/domain/       invoice rules, money, queries, CSV
src/email/        email templates, delivery (Resend / Mailpit), logging
src/jobs/         scheduled jobs and their clock maths
src/ui/           shared components
supabase/         config, migrations, seed.sql
scripts/          dev user seeding
```

## Scheduled jobs and email

An outside scheduler calls `/api/cron` every 15 minutes with `Authorization: Bearer $CRON_SECRET` (cron-job.org works on the free tier; Vercel Hobby only allows one cron run a day, so `vercel.json` has none. On Vercel Pro you can add `"crons": [{ "path": "/api/cron", "schedule": "*/15 * * * *" }]` back). Each job checks the clock in the right timezone and the notification log, so a late or repeated run never sends anything twice:

| Job | When | To |
| --- | --- | --- |
| Monthly drafts | Every run (no-op once created) | — |
| Exchange rates | Once a day, if `FX_PROVIDER` is set | — |
| Daily summary | From `daily_summary_time` (8:00) in the CEO's timezone; skipped when everything is paid | CEO |
| Review deadline warning | 24 hours before each invoice's review deadline | CEO |
| Overdue alert | Once, when a review deadline passes without approval | Accounts |
| Monthly summary | From the 15th, 6:30 PM Sri Lanka time (setting `monthly_summary`) | CEO, accounts |

Status emails (approved, rejected with the comment, marked paid by the CEO) go to the employee straight after the CEO acts. Every email is written to `notification_logs`, including failures.

Run the jobs locally, optionally as if at another moment:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron?now=2026-11-15T13:05:00Z"
```

`?now=` is ignored in production. Email goes through Resend when `RESEND_API_KEY` is set, otherwise to Mailpit (`MAILPIT_URL`); production refuses to run without Resend.

## Invoice PDFs and the Google Sheet backup

- `/pdf/<invoice id>` returns the invoice PDF (owner and staff only): QNetwork's Business Number and address, the worker's name, address and NIC or passport number, lines and totals. Both invoice pages link to it, and the monthly summary attaches the month's PDFs.
- The `sheet_backup` job appends each approved invoice to the backup sheet once (`GOOGLE_SA_JSON`, `BACKUP_SHEET_ID`). Values are written as plain values, never formulas.

## Launch checklist

The admin overview (`/admin`) shows most of these live.

1. **Supabase project (production):** Pro plan for daily database backups. Link it and run `supabase db push`; reference data and default settings come with the migrations. In Auth settings, set the Site URL and add `https://<domain>/auth/confirm` to redirect URLs, keep sign-ups off, and turn on TOTP MFA.
2. **Receipts and PDFs backup:** Supabase backups cover the database, not Storage files. Schedule a copy of the `attachments` bucket (e.g. `supabase storage cp` or rclone to another bucket) daily.
3. **Vercel:** a scheduler that calls `/api/cron` every 15 minutes (see Scheduled jobs), environment variables from `.env.example` (no `MAILPIT_URL`), `APP_URL` set to the real domain.
4. **Email:** verify the sending domain in Resend; set `RESEND_API_KEY` and `EMAIL_FROM`. Supabase sends the "Email me a link" messages itself, so also set Resend as its SMTP server (Auth → Emails → SMTP: `smtp.resend.com`, port 465, user `resend`, password = the API key), raise the email rate limit, and set the email OTP expiry to 86400 seconds (the emails promise 24 hours).
   **Google (optional):** create an OAuth client in Google Cloud with the redirect URI `https://<project>.supabase.co/auth/v1/callback`, turn on the Google provider in Supabase, then set `GOOGLE_SIGN_IN=on` in Vercel and redeploy.
5. **Admin settings:** company Business Number and address, who pays Wise fees, then add every employee with their currency, address and NIC or passport number (their code is given automatically).
6. **Exchange rates:** set `FX_PROVIDER=open-er-api` in Vercel and redeploy. This is ExchangeRate-API's free daily feed and needs no key; its terms require the attribution link on `/accounts`. Rates start with the next scheduled run, and invoices submitted before the first rate have no CAD value.
   **Open decision:** the accountant's tax confirmation before switching any tax rate on.
7. **Pilot:** admin, CEO and two or three employees for one monthly cycle; keep the Google Sheet as a read-only backup; retire it after a few months of matching records.

## How people sign in

1. The admin adds a person at `/admin/users`. The app emails them an invitation through the normal email route (Resend, or Mailpit locally). The person's page has a "Send invitation" button if it expired.
2. The invitation's one-time link signs them in. Approver, accounts and admin set up two-factor first.
3. Anyone who arrived by email link and has no password is sent to `/set-password`, then to their home page. "Change password" in the header opens the same page, so a forgotten password is: request an email link, sign in, change it.
4. After that they can use their password, an email link, or Continue with Google. Google only works for an address the admin has added, because sign-ups are off.

## How access works

- `proxy.ts` refreshes the session and sends signed-out visitors to `/login`.
- Every page and action calls `requireAccess([...roles])` from `src/auth/dal.ts`.
- Approver, accounts and admin need a two-factor (aal2) session everywhere.
- The database enforces the same rules with row-level security: employees read only their own invoices; staff reads need aal2.
- Inactive users are signed out on their next request.

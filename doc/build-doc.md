# Invoice System — Build Doc

Oct 28, 2026 · Delojan Aruleswaran

> Repo copy of the [live build doc](https://claude.ai/artifact/PPhDUgtqfNJkBppdGJtYBe). The PRD is in this folder: `QNetwork Invoice System — PRD.pdf`.

## Overview

We build version 1 of the QNetwork Invoice System as one web app with scheduled jobs, delivered in six milestones and tested with the admin, CEO and 2–3 employees before going live. This doc turns the PRD (Oct 26, 2026) into a build plan; M1 was finished, tested and merged to main on Oct 28, 2026.

- **In scope:** monthly invoices for about 25 employees, CEO approval (single and bulk), payment recording, LKR and CAD, audit trail, emails, PDFs, CSV and Google Sheet export.
- **Out of scope for v1:** sending Wise payments from the app, and payroll calculations.

## Architecture and tech stack

One TypeScript codebase runs on Vercel — the web app people use plus scheduled jobs triggered by Vercel Cron — on one Supabase project that provides the database, login and file storage.

```
One database is the system of record for the app and its jobs

┌──────────────────────────────┐
│ Browsers                     │
│ Employee, CEO, Accounts,     │
│ Admin                        │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐    ┌─────────────────────┐    ┌──────────────────────────────┐
│ Web app (Next.js on Vercel)  │───►│ Supabase Postgres   │◄───│ Scheduled jobs (Vercel Cron) │
│ Screens, API, invoice PDFs   │    │ Invoices, audit     │    │ Monthly drafts, daily FX     │
│ Login, two-factor, role      │    │ trail, settings,    │    │ rates, summaries, warnings,  │
│ checks                       │    │ rates, logs         │    │ alerts                       │
└───────┬──────────────┬───────┘    └─────────────────────┘    └──────┬─────────┬────────┬────┘
        │              │                                              │         │        │
        ▼              └──────────────────┐   ┌───────────────────────┘         │        │
┌──────────────────┐               ┌──────▼───▼──┐               ┌──────────────▼┐  ┌────▼──────────┐
│ Supabase Storage │               │ Resend      │               │ FX provider   │  │ Google Sheet  │
│ Receipts, PDFs   │               │ Every email │               │ LKR, CAD rates│  │ Backup export │
└──────────────────┘               └─────────────┘               └───────────────┘  └───────────────┘
```

The web app handles every screen and the PDF; the scheduled jobs send every timed email and fetch rates; status-change emails go out from the app at the moment of the change.

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js with TypeScript, hosted on Vercel | One codebase for screens and API; works on phone and desktop |
| Database | Supabase Postgres | Relational, as the PRD suggests; row locks for invoice numbering; row-level security so employees see only their own invoices |
| Login | Supabase Auth: email link or password, TOTP two-factor | Two-factor enforced for approver, accounts and admin |
| Files | Supabase Storage, private bucket, signed links | Receipts and PDFs kept out of the database |
| Jobs | Vercel Cron calls one protected route every hour; it runs whatever is due | No separate worker to host; hourly runs cover send times in each recipient's timezone |
| Email | Resend | Delivery status feeds the notification log |
| PDF | React-PDF | Invoice layout kept in code next to the data |
| Exchange rates | Decide later, behind a provider interface | Must cover LKR and CAD; pick before M5 |

## Prerequisites and setup

A developer needs Node.js 24 LTS, pnpm 9, Docker, the Supabase CLI and Git.

1. Clone the repo and run `pnpm install` (the Supabase CLI comes in as a dev dependency).
2. Start Docker Desktop, then run `pnpm db:start` — it runs Postgres, Auth, Storage and a local mail viewer, and prints the local keys.
3. Copy `.env.example` to `.env.local` and paste in the URL, publishable key and secret key.
4. Run `pnpm db:reset` — applies migrations and `seed.sql` (LKR and CAD, the four line types, tax rates switched off, default settings), then creates one dev user per role. All dev users share the password `LocalDev2026`.
5. Run `pnpm dev`; the app opens at `http://localhost:3000`, sign-in emails show at `http://localhost:54324` and Supabase Studio at `http://localhost:54323`.

Repo layout (as built in M1):

```
invoice-system/
  app/              routes: (app)/employee, approver, accounts, admin; login; mfa; auth
  src/auth/         access.ts (rules, unit-tested), dal.ts (per-request check)
  src/supabase/     clients for server code, admin tasks and the proxy
  src/ui/           shared components
  src/domain/       invoice state machine, numbering, money and tax maths (M2)
  src/jobs/         scheduled jobs (M5)
  src/email/        Resend email templates (M5)
  src/pdf/          invoice PDF template (M6)
  supabase/         config.toml, migrations, seed.sql, tests/
  scripts/          dev user seeding
  proxy.ts          session refresh and sign-in redirect
  doc/              PRD and this build doc
```

## Configuration

Secrets and infrastructure live in environment variables; every business rule the PRD calls adjustable (review period, email times, recipients, number format, Wise fee payer, company BN and address) lives in the `settings` table and is edited in the admin screens, never in env.

| Variable | Purpose | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `http://127.0.0.1:54321` locally |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key; row-level security limits what it sees | `sb_publishable_…` from `pnpm db:start` |
| `SUPABASE_SECRET_KEY` | Server-only key for scheduled jobs, admin actions and seeding | `sb_secret_…`; never sent to the browser |
| `APP_URL` | Base URL used in email links | `http://localhost:3000` |
| `CRON_SECRET` | Lets only Vercel Cron call the jobs route (M5) | random string, set in Vercel |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend email sending (M5) | sending address to confirm |
| `FX_PROVIDER_URL`, `FX_API_KEY` | Daily exchange-rate fetch (M5) | provider not chosen yet |
| `GOOGLE_SA_JSON`, `BACKUP_SHEET_ID` | Export to the Google Sheet backup (M6) | service account key |

Seeded defaults: review period 10 days; daily summary 8:00 AM in the CEO's timezone; monthly summary on the 15th at 6:30 PM Asia/Colombo; base currency CAD; number format `QN-EMP-YYYY-MM-NNN`.

## Build plan

We build in six milestones, each ending in something the admin can click through; the domain rules in milestone 2 come first because every screen depends on them.

- [x] **M1 Foundation** — repo, CI, Postgres schema for all PRD entities, seed data, login by email link or password, two-factor for approver, accounts and admin, role-based route guards. *Done Oct 28, 2026: 8 unit tests and 22 database access tests pass; every role's sign-in tested in the browser; merged to main.*
- [ ] **M2 Invoice core** — invoice state machine, numbering, money and tax maths, line items, attachments with receipt rules, audit trail on every change.
- [ ] **M3 Employee flow** — auto-created monthly drafts, edit lines, confirm and submit, recall until review starts, resubmit after rejection, mark Paid with amount received.
- [ ] **M4 Approver and accounts** — CEO queue with single and bulk approve, reject with comment, bulk mark Paid; accounts dashboard with filters, payment confirmation against Wise, CSV export.
- [ ] **M5 Automation** — daily exchange-rate fetch, daily CEO summary, 24-hour deadline warning, overdue alert to accounts, status emails, monthly summary with PDFs, notification log.
- [ ] **M6 Admin and launch** — users, currencies, tax rates, line types, settings, email templates, invoice PDF, Google Sheet export, backups, pilot.

### How access works (M1)

- `proxy.ts` refreshes the session on every request and sends signed-out visitors to `/login`.
- Every page and action calls `requireAccess([...roles])`; approver, accounts and admin need a two-factor session everywhere, including employee pages.
- The database enforces the same rules with row-level security: employees read only their own invoices, and staff reads need a two-factor session.
- Sign-up is off; only users an admin creates can sign in. Inactive users are signed out on their next request.
- Next.js 16.4 turns on Cache Components by default, so signed-in pages set `export const instant = false` and wait for the access check on the server.

### Rules to get right

| Rule | How we build it |
| --- | --- |
| Invoice numbers never repeat, skip or change | Per-employee counter row locked inside the submit transaction; number assigned on first submit (drafts have none) and stored read-only. |
| One invoice per employee per month | Unique index on (employee, month); draft job is idempotent. |
| Money is exact | Store amounts as integer minor units per the currency's decimal places; tax per line, rounded half-up. |
| Recall only until the CEO opens it | First CEO view sets `review started at`; recall checks it is empty in the same transaction. |
| Review deadline | `submitted at` + review period, reset on every resubmission. |
| No silent conversion | Invoice keeps its own currency; submission-date rate and Wise actual rate stored separately for reports. |
| Times | Stored in UTC; shown in the viewer's timezone; jobs scheduled per recipient timezone. |
| Attachments | PDF, JPG, PNG up to 10 MB, private Supabase Storage bucket, short-lived signed links checked against the viewer's role. |

### Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs the web app locally; trigger jobs by calling the jobs route |
| `pnpm db:start` / `pnpm db:stop` | Starts or stops local Supabase in Docker |
| `pnpm db:reset` | Rebuilds the local database from migrations and seeds, then creates dev users |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Database access tests (pgTAP) |
| `pnpm lint`, `pnpm typecheck` | Static checks |
| `pnpm build` | Production build |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every push, then applies the migrations to a fresh database and runs the database access tests.

## Deployment

We deploy the Next.js app to Vercel, with one Supabase project per environment; scheduled jobs run through Vercel Cron, which needs the Pro plan for hourly runs (Hobby allows once a day).

- **Environments:** a Vercel preview per pull request, staging (pilot users, seeded test data) and production, each on its own Supabase project; every merge to `main` deploys to staging, production deploys by tagged release.
- **Migrations:** applied with `supabase db push` in CI before the Vercel deploy; never edited after release.
- **Backups:** Supabase daily database backups plus a daily copy of the storage bucket; restore tested once before go-live.
- **Monitoring:** error tracking on the app and scheduled jobs; an alert when a scheduled job fails or an email bounces.

Rollout follows the PRD:

1. Pilot on staging with the admin, CEO and two or three employees for one full monthly cycle.
2. Go live for all employees; the Google Sheet becomes read-only and receives approved invoices by export.
3. After a few months of matching records, retire the sheet.

## Open questions

Four items are settled; four are still open, and tax stays off until the accountant confirms.

- [ ] Choose the exchange-rate provider (must cover LKR and CAD) — deferred; built behind an interface, needed before M5.
- [ ] Choose the default for who pays Wise fees — deferred; an admin setting, needed before launch.
- [ ] Accountant confirms tax rates for LKR and CAD, whether VAT or GST applies, and the "Professional fees" label — v1 ships with tax switched off.
- [ ] Pick the email sending address and verify its domain in Resend.
- [x] Stack: Supabase for database, login and storage, with Next.js.
- [x] Hosting: Vercel, with Vercel Cron for scheduled jobs.
- [x] Invoice number assigned on first submit.
- [x] Email service: Resend.

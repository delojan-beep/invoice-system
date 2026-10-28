# QNetwork Invoice System

Monthly invoicing for QNetwork: employees submit, the CEO approves, payment is recorded. See `doc/` for the PRD.

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

Vercel Cron calls `/api/cron` every 15 minutes (`vercel.json`; needs the Vercel Pro plan, as Hobby allows one run a day) with `Authorization: Bearer $CRON_SECRET`. Each job checks the clock in the right timezone and the notification log, so a late or repeated run never sends anything twice:

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

## How access works

- `proxy.ts` refreshes the session and sends signed-out visitors to `/login`.
- Every page and action calls `requireAccess([...roles])` from `src/auth/dal.ts`.
- Approver, accounts and admin need a two-factor (aal2) session everywhere.
- The database enforces the same rules with row-level security: employees read only their own invoices; staff reads need aal2.
- Inactive users are signed out on their next request.

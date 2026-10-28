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

Local email (sign-in links) shows up at http://localhost:54324. Supabase Studio is at http://localhost:54323.

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
src/ui/           shared components
supabase/         config, migrations, seed.sql
scripts/          dev user seeding
```

## How access works

- `proxy.ts` refreshes the session and sends signed-out visitors to `/login`.
- Every page and action calls `requireAccess([...roles])` from `src/auth/dal.ts`.
- Approver, accounts and admin need a two-factor (aal2) session everywhere.
- The database enforces the same rules with row-level security: employees read only their own invoices; staff reads need aal2.
- Inactive users are signed out on their next request.

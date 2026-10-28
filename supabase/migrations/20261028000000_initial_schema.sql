-- QNetwork Invoice System: initial schema (milestone M1).
-- Every PRD entity, row-level security, and private storage buckets.
-- Money is stored as integer minor units in the invoice currency (cents, cents of LKR).
-- All timestamps are timestamptz (stored in UTC, shown in the viewer's timezone).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('employee', 'approver', 'accounts', 'admin');
create type public.user_status as enum ('active', 'inactive');
create type public.invoice_status as enum ('draft', 'submitted', 'approved', 'rejected', 'paid');
create type public.paid_marker as enum ('approver', 'employee');
create type public.wise_fee_payer as enum ('company', 'deducted');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimal_places smallint not null check (decimal_places between 0 and 4),
  active boolean not null default true
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  percentage numeric(6, 3) not null check (percentage >= 0 and percentage <= 100),
  label text not null, -- shown on invoices, e.g. VAT for LKR, GST/HST for CAD
  currency_code text not null references public.currencies (code),
  active boolean not null default false -- ships switched off until the accountant confirms
);

create table public.line_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  receipt_required boolean not null default false,
  default_tax_rate_id uuid references public.tax_rates (id),
  active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  from_currency text not null references public.currencies (code),
  to_currency text not null references public.currencies (code),
  rate numeric(20, 10) not null check (rate > 0),
  source text not null,
  created_at timestamptz not null default now(),
  unique (rate_date, from_currency, to_currency)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users and roles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  name text not null,
  email text not null unique,
  employee_code text unique check (employee_code ~ '^[A-Z0-9]{2,10}$'),
  status public.user_status not null default 'active',
  nic_or_tin text,
  address text,
  timezone text not null default 'Asia/Colombo',
  default_currency text references public.currencies (code),
  wise_recipient_ref text,
  -- Running invoice number (NNN). Incremented only when an invoice is first submitted.
  last_invoice_seq integer not null default 0 check (last_invoice_seq >= 0),
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- QN-EMP-YYYY-MM-NNN, assigned on first submit; never edited afterwards.
  number text unique,
  employee_reference text, -- the employee's optional "My reference"
  employee_id uuid not null references public.profiles (id),
  month date not null check (extract(day from month) = 1),
  currency_code text not null references public.currencies (code),
  status public.invoice_status not null default 'draft',
  subtotal_minor bigint not null default 0,
  tax_total_minor bigint not null default 0,
  total_minor bigint not null default 0,
  exchange_rate_to_base numeric(20, 10), -- rate on the submission date, for base-currency reports
  employee_confirmed_at timestamptz,
  submitted_at timestamptz,
  recalled_at timestamptz,
  review_started_at timestamptz,
  review_deadline timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  marked_paid_by public.paid_marker,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, month)
);

create index invoices_status_idx on public.invoices (status);
create index invoices_month_idx on public.invoices (month);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- Once assigned, an invoice number can never change.
create function public.protect_invoice_number() returns trigger
language plpgsql as $$
begin
  if old.number is not null and new.number is distinct from old.number then
    raise exception 'Invoice number % cannot be changed', old.number;
  end if;
  return new;
end;
$$;

create trigger invoices_protect_number before update on public.invoices
  for each row execute function public.protect_invoice_number();

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_type_id uuid not null references public.line_types (id),
  description text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  rate_minor bigint not null check (rate_minor >= 0),
  tax_rate_id uuid references public.tax_rates (id),
  tax_minor bigint not null default 0,
  line_total_minor bigint not null default 0,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index line_items_invoice_idx on public.line_items (invoice_id);

create trigger line_items_updated_at before update on public.line_items
  for each row execute function public.set_updated_at();

-- Files live in private storage; this table only points at them.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index attachments_line_item_idx on public.attachments (line_item_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  wise_transfer_id text,
  amount_sent_minor bigint,
  sent_currency text references public.currencies (code),
  wise_fee_minor bigint,
  fee_paid_by public.wise_fee_payer,
  amount_received_minor bigint,
  received_currency text references public.currencies (code),
  actual_exchange_rate numeric(20, 10),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id),
  confirmed_by_accounts_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_invoice_idx on public.payments (invoice_id);

-- Audit trail: every change to an invoice. Append-only.
create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  actor_id uuid references public.profiles (id), -- null for system jobs
  action text not null,
  previous_status public.invoice_status,
  new_status public.invoice_status,
  comment text,
  system_note text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index approval_events_invoice_idx on public.approval_events (invoice_id, created_at);

create function public.reject_audit_change() returns trigger
language plpgsql as $$
begin
  raise exception 'The audit trail is append-only';
end;
$$;

create trigger approval_events_append_only before update or delete on public.approval_events
  for each row execute function public.reject_audit_change();

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient text not null,
  invoice_id uuid references public.invoices (id),
  provider_message_id text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

create index notification_logs_invoice_idx on public.notification_logs (invoice_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- True when the signed-in user is active and holds the role. Approver, accounts
-- and admin also need a two-factor session (aal2), so a stolen password alone
-- never reaches other people's invoices.
create function public.has_role(required public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = required
      and p.status = 'active'
  )
  and (required = 'employee' or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('approver') or public.has_role('accounts') or public.has_role('admin');
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- Writes to invoices, lines, payments and the audit trail go through server
-- code (milestone M2), so only read policies are defined for those tables here.
-- ---------------------------------------------------------------------------

alter table public.currencies enable row level security;
alter table public.tax_rates enable row level security;
alter table public.line_types enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.invoices enable row level security;
alter table public.line_items enable row level security;
alter table public.attachments enable row level security;
alter table public.payments enable row level security;
alter table public.approval_events enable row level security;
alter table public.notification_logs enable row level security;

-- Reference data: readable by active users, managed by admins.
create policy "active users read currencies" on public.currencies
  for select to authenticated using (public.is_active_user());
create policy "admins manage currencies" on public.currencies
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "active users read tax rates" on public.tax_rates
  for select to authenticated using (public.is_active_user());
create policy "admins manage tax rates" on public.tax_rates
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "active users read line types" on public.line_types
  for select to authenticated using (public.is_active_user());
create policy "admins manage line types" on public.line_types
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "active users read exchange rates" on public.exchange_rates
  for select to authenticated using (public.is_active_user());

create policy "active users read settings" on public.settings
  for select to authenticated using (public.is_active_user());
create policy "admins manage settings" on public.settings
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- People: everyone sees themselves; staff see everyone; admins manage.
create policy "read own profile or staff" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "admins manage profiles" on public.profiles
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "read own roles or admin" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role('admin'));
create policy "admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Invoices: employees see only their own; staff see all.
create policy "read own invoices or staff" on public.invoices
  for select to authenticated
  using ((employee_id = auth.uid() and public.is_active_user()) or public.is_staff());

-- Child rows follow the invoice they belong to (the subquery is itself filtered by RLS).
create policy "read lines of visible invoices" on public.line_items
  for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "read attachments of visible lines" on public.attachments
  for select to authenticated
  using (exists (select 1 from public.line_items li where li.id = line_item_id));

create policy "read payments of visible invoices" on public.payments
  for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "read audit of visible invoices" on public.approval_events
  for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

create policy "accounts and admins read notification log" on public.notification_logs
  for select to authenticated using (public.has_role('accounts') or public.has_role('admin'));

-- ---------------------------------------------------------------------------
-- Private storage (signed links only; access policies arrive with M2)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('invoice-pdfs', 'invoice-pdfs', false, 10485760, array['application/pdf']);

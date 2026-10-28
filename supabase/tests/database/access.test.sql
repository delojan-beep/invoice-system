-- Access rules for M1: who can read and change what. Run with `pnpm test:db`.
-- Each test acts as a user by setting the JWT claims Supabase would send.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e3', 'e3@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'ceo@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'acc@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'adm@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, name, email, employee_code, status, default_currency) values
  ('00000000-0000-0000-0000-0000000000e1', 'Employee One', 'e1@test.local', 'T001', 'active', 'LKR'),
  ('00000000-0000-0000-0000-0000000000e2', 'Employee Two', 'e2@test.local', 'T002', 'active', 'CAD'),
  ('00000000-0000-0000-0000-0000000000e3', 'Left Company', 'e3@test.local', 'T003', 'inactive', 'LKR'),
  ('00000000-0000-0000-0000-0000000000c1', 'The CEO', 'ceo@test.local', null, 'active', null),
  ('00000000-0000-0000-0000-0000000000a1', 'Accounts', 'acc@test.local', null, 'active', null),
  ('00000000-0000-0000-0000-0000000000d1', 'Admin', 'adm@test.local', null, 'active', null);

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'employee'),
  ('00000000-0000-0000-0000-0000000000e2', 'employee'),
  ('00000000-0000-0000-0000-0000000000e3', 'employee'),
  ('00000000-0000-0000-0000-0000000000c1', 'approver'),
  ('00000000-0000-0000-0000-0000000000a1', 'accounts'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin');

insert into public.invoices (id, number, employee_id, month, currency_code, status) values
  ('10000000-0000-0000-0000-000000000001', 'QN-T001-2026-10-001', '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'LKR', 'draft'),
  ('10000000-0000-0000-0000-000000000002', null, '00000000-0000-0000-0000-0000000000e2', '2026-10-01', 'CAD', 'draft'),
  ('10000000-0000-0000-0000-000000000003', null, '00000000-0000-0000-0000-0000000000e3', '2026-10-01', 'LKR', 'draft');

insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
select '10000000-0000-0000-0000-000000000001', id, 'October fees', 25000000
from public.line_types where name = 'Professional fees';

-- Lines can only be added while editable, so submit after adding.
update public.invoices set status = 'submitted' where id = '10000000-0000-0000-0000-000000000001';

insert into public.approval_events (id, invoice_id, actor_id, action, new_status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000e1', 'submit', 'submitted');

-- Acts as a signed-in user at the given assurance level.
create function pg_temp.act_as(uid uuid, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Database rules that hold for everyone
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.invoices set number = 'QN-T001-2026-10-999' where id = '10000000-0000-0000-0000-000000000001' $$,
  'P0001', null, 'an assigned invoice number cannot be changed, even by the owner'
);
select lives_ok(
  $$ update public.invoices set number = 'QN-T002-2026-10-001' where id = '10000000-0000-0000-0000-000000000002' $$,
  'a draft without a number can receive one'
);
select throws_ok(
  $$ update public.approval_events set comment = 'edited' where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'The audit trail is append-only', 'audit events cannot be edited'
);
select throws_ok(
  $$ delete from public.approval_events where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'The audit trail is append-only', 'audit events cannot be deleted'
);
select throws_ok(
  $$ insert into public.invoices (employee_id, month, currency_code) values ('00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'LKR') $$,
  '23505', null, 'only one invoice per employee per month'
);

-- ---------------------------------------------------------------------------
-- Signed out
-- ---------------------------------------------------------------------------

set local role anon;
select is((select count(*) from public.invoices), 0::bigint, 'signed-out visitors see no invoices');
select is((select count(*) from public.profiles), 0::bigint, 'signed-out visitors see no people');
reset role;

-- ---------------------------------------------------------------------------
-- Employee
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select results_eq(
  'select id from public.invoices',
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'an employee sees only their own invoice'
);
select is((select count(*) from public.line_items), 1::bigint, 'an employee sees the lines of their own invoice');
select is((select count(*) from public.profiles), 1::bigint, 'an employee sees only their own profile');
select is((select count(*) from public.currencies), 2::bigint, 'an employee can read reference data');
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'admin') $$,
  '42501', null, 'an employee cannot give themselves a role'
);
select lives_ok(
  $$ update public.invoices set status = 'paid' where id = '10000000-0000-0000-0000-000000000001' $$,
  'an employee update statement runs...'
);
reset role;
select is(
  (select status::text from public.invoices where id = '10000000-0000-0000-0000-000000000001'),
  'submitted', '...but changes nothing: invoice writes go through server code'
);

-- Inactive employee
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3', 'aal1');
select is((select count(*) from public.invoices), 0::bigint, 'an inactive employee sees no invoices, not even their own');
reset role;

-- ---------------------------------------------------------------------------
-- Approver, accounts and admin need two-factor
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal1');
select is((select count(*) from public.invoices), 0::bigint, 'the CEO without two-factor sees no invoices');
select is((select count(*) from public.profiles), 1::bigint, 'the CEO without two-factor sees only their own profile');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select is((select count(*) from public.invoices), 3::bigint, 'the CEO with two-factor sees every invoice');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select count(*) from public.invoices), 3::bigint, 'accounts with two-factor sees every invoice');
select is((select count(*) from public.user_roles), 1::bigint, 'accounts sees only their own roles');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal1');
select throws_ok(
  $$ insert into public.currencies (code, name, symbol, decimal_places) values ('USD', 'US dollar', '$', 2) $$,
  '42501', null, 'an admin without two-factor cannot change reference data'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal2');
select lives_ok(
  $$ insert into public.currencies (code, name, symbol, decimal_places) values ('USD', 'US dollar', '$', 2) $$,
  'an admin with two-factor can add a currency'
);
reset role;

select * from finish();
rollback;

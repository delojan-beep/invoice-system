-- Admin (M6): reference data ships with the migrations, and only an admin
-- with two-factor can change settings and lists. Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Shipped by migrations (production never runs seed.sql).
select ok((select count(*) from public.currencies where code in ('LKR', 'CAD')) = 2, 'LKR and CAD exist');
select ok((select count(*) from public.line_types where name in ('Professional fees', 'Expense', 'App fee', 'Other')) = 4, 'the four line types exist');
select ok(
  (select count(*) from public.tax_rates where name in ('VAT 18%', 'GST 5%', 'HST 13%') and not active) = 3,
  'the placeholder tax rates exist, switched off'
);
select ok(
  (select count(*) from public.settings where key in ('review_period_days', 'daily_summary_time', 'monthly_summary',
    'summary_recipients', 'reminder_fields', 'invoice_number_format', 'base_currency', 'wise_fee_payer', 'company', 'email_wording')) = 10,
  'every PRD default setting exists'
);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'adm@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'acc@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code, default_currency) values
  ('00000000-0000-0000-0000-0000000000d1', 'Admin', 'adm@test.local', null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'Accounts', 'acc@test.local', null, null),
  ('00000000-0000-0000-0000-0000000000e1', 'Employee', 'e1@test.local', 'T001', 'CAD');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'admin'),
  ('00000000-0000-0000-0000-0000000000a1', 'accounts'),
  ('00000000-0000-0000-0000-0000000000e1', 'employee');

create function pg_temp.act_as(uid uuid, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Settings
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal2');
update public.settings set value = '12' where key = 'review_period_days';
reset role;
select is((select value::text from public.settings where key = 'review_period_days'), '12', 'an admin with two-factor can change a setting');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal1');
update public.settings set value = '99' where key = 'review_period_days';
reset role;
select is((select value::text from public.settings where key = 'review_period_days'), '12', 'an admin without two-factor changes nothing');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
update public.settings set value = '99' where key = 'review_period_days';
reset role;
select is((select value::text from public.settings where key = 'review_period_days'), '12', 'accounts cannot change settings');

-- Lists
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
update public.tax_rates set active = true where name = 'VAT 18%';
select throws_ok(
  $$ insert into public.line_types (name) values ('Bonus') $$,
  '42501', null, 'an employee cannot add line types'
);
reset role;
select is((select active from public.tax_rates where name = 'VAT 18%'), false, 'an employee cannot switch a tax rate on');

-- Deleting line types
insert into public.line_types (name) values ('Unused type'), ('Used type');
insert into public.invoices (id, employee_id, month, currency_code) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'CAD');
insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
select '00000000-0000-0000-0000-0000000000f1', id, 'Fees', 100 from public.line_types where name = 'Used type';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
delete from public.line_types where name = 'Unused type';
reset role;
select ok(exists (select 1 from public.line_types where name = 'Unused type'), 'an employee cannot delete a line type');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal1');
delete from public.line_types where name = 'Unused type';
reset role;
select ok(exists (select 1 from public.line_types where name = 'Unused type'), 'an admin without two-factor cannot delete a line type');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', 'aal2');
delete from public.line_types where name = 'Unused type';
select throws_ok(
  $$ delete from public.line_types where name = 'Used type' $$,
  '23503', null, 'a line type on an invoice cannot be deleted'
);
reset role;
select ok(not exists (select 1 from public.line_types where name = 'Unused type'), 'an admin with two-factor can delete an unused line type');

-- People
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
select is(
  (select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'active', 'only admins can make someone inactive'
);

select * from finish();
rollback;

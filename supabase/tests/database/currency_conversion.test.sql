-- Changing an invoice's currency converts its lines at the latest stored rate,
-- and refuses when there is no rate. Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code, default_currency) values
  ('00000000-0000-0000-0000-0000000000c1', 'Convert One', 'c1@test.local', 'T101', 'CAD');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'employee');

insert into public.currencies (code, name, symbol, decimal_places, active) values
  ('TST', 'Test money with no rate', 'T', 2, true);

-- An older rate first, so the test proves the latest one is used.
insert into public.exchange_rates (rate_date, from_currency, to_currency, rate, source) values
  ('2020-01-01', 'LKR', 'CAD', 0.0100000000, 'test'),
  ('2099-01-01', 'LKR', 'CAD', 0.0050000000, 'test');

insert into public.invoices (id, employee_id, month, currency_code) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', '2026-10-01', 'CAD'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', '2026-09-01', 'CAD'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', '2026-08-01', 'CAD');
insert into public.line_items (invoice_id, line_type_id, description, quantity, rate_minor)
select i, t.id, 'Consulting', 2, 10000
from (values ('30000000-0000-0000-0000-000000000001'::uuid), ('30000000-0000-0000-0000-000000000002'::uuid)) v(i),
  (select id from public.line_types where name = 'Professional fees') t;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');

select lives_ok(
  $$ select public.update_invoice_details('30000000-0000-0000-0000-000000000001', 'LKR', '') $$,
  'an invoice with lines can change to a currency that has a rate'
);
select is(
  (select rate_minor from public.line_items where invoice_id = '30000000-0000-0000-0000-000000000001'),
  2000000::bigint,
  '100.00 CAD at the latest rate of 1 LKR = 0.005 CAD becomes 20,000.00 LKR'
);
select is(
  (select total_minor from public.invoices where id = '30000000-0000-0000-0000-000000000001'),
  4000000::bigint,
  'the invoice total follows its converted lines'
);
select is(
  (select currency_code from public.invoices where id = '30000000-0000-0000-0000-000000000001'),
  'LKR',
  'the invoice takes the new currency'
);
select ok(
  exists (select 1 from public.approval_events where invoice_id = '30000000-0000-0000-0000-000000000001' and action = 'currency_convert' and system_note like 'From CAD to LKR, at 1 CAD = 200%'),
  'the audit trail records the conversion and its rate'
);

select throws_ok(
  $$ select public.update_invoice_details('30000000-0000-0000-0000-000000000002', 'TST', '') $$,
  'P0001',
  'There''s no exchange rate for TST yet, so this invoice can''t be converted. Try again tomorrow.',
  'a currency with no stored rate is refused'
);
select is(
  (select rate_minor from public.line_items where invoice_id = '30000000-0000-0000-0000-000000000002'),
  10000::bigint,
  'a refused change leaves the line as it was'
);

select lives_ok(
  $$ select public.update_invoice_details('30000000-0000-0000-0000-000000000003', 'TST', '') $$,
  'an invoice with no lines needs no rate'
);

select * from finish();
rollback;

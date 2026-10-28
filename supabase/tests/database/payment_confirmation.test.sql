-- Accounts confirm payments against Wise (M4). Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'ceo@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'acc@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code, default_currency) values
  ('00000000-0000-0000-0000-0000000000e1', 'Employee One', 'e1@test.local', 'T001', 'LKR'),
  ('00000000-0000-0000-0000-0000000000c1', 'The CEO', 'ceo@test.local', null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'Accounts', 'acc@test.local', null, null);
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'employee'),
  ('00000000-0000-0000-0000-0000000000c1', 'approver'),
  ('00000000-0000-0000-0000-0000000000a1', 'accounts');

create function pg_temp.act_as(uid uuid, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- An approved invoice, marked paid by the CEO.
insert into public.invoices (id, number, employee_id, month, currency_code, status) values
  ('10000000-0000-0000-0000-000000000001', 'QN-T001-2026-10-001', '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'LKR', 'approved');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select public.mark_invoices_paid(array['10000000-0000-0000-0000-000000000001'::uuid]);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select throws_ok(
  $$ select public.confirm_payment('10000000-0000-0000-0000-000000000001', 'T1', 100, 'CAD', 5, 'company', 25000000, 'LKR', 220.5) $$,
  '42501', null, 'the CEO cannot confirm payments; accounts do'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select throws_ok(
  $$ select public.confirm_payment('10000000-0000-0000-0000-000000000001', 'T1', 100, 'CAD', 5, 'company', 25000000, 'LKR', 220.5) $$,
  '42501', null, 'accounts need two-factor'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ select public.confirm_payment('10000000-0000-0000-0000-000000000001', '  ', 100, 'CAD', 5, 'company', 25000000, 'LKR', 220.5) $$,
  'P0001', 'Add the Wise transfer ID', 'a Wise transfer ID is required'
);
select lives_ok(
  $$ select public.confirm_payment('10000000-0000-0000-0000-000000000001', ' 987654321 ', 113636, 'CAD', 412, 'company', 25000000, 'LKR', 220.0001) $$,
  'accounts confirm the payment with the Wise details'
);
reset role;

select results_eq(
  $$ select wise_transfer_id, amount_sent_minor, sent_currency, wise_fee_minor, fee_paid_by::text,
            amount_received_minor, received_currency, actual_exchange_rate, confirmed_by_accounts_at is not null,
            confirmed_by, recorded_by
     from public.payments where invoice_id = '10000000-0000-0000-0000-000000000001' $$,
  $$ values ('987654321', 113636::bigint, 'CAD', 412::bigint, 'company', 25000000::bigint, 'LKR', 220.0001::numeric, true,
             '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid) $$,
  'the payment keeps who marked it paid and who confirmed it, with the Wise details'
);
select is(
  (select system_note from public.approval_events
   where invoice_id = '10000000-0000-0000-0000-000000000001' and action = 'payment_confirm'),
  'Wise 987654321', 'the confirmation is in the audit trail'
);

-- A payment can only be confirmed once the invoice is paid.
insert into public.invoices (id, employee_id, month, currency_code, status) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1', '2026-11-01', 'LKR', 'approved');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ select public.confirm_payment('10000000-0000-0000-0000-000000000002', 'T2', 1, 'CAD', 0, 'company', 1, 'LKR', 1) $$,
  'P0001', 'Only invoices marked paid can be confirmed', 'unpaid invoices cannot be confirmed'
);
reset role;

select * from finish();
rollback;

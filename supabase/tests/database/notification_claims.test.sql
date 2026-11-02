-- Send-once claims for scheduled emails (M5). Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code, default_currency) values
  ('00000000-0000-0000-0000-0000000000e1', 'Employee One', 'e1@test.local', 'T001', 'CAD');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'employee');
insert into public.invoices (id, employee_id, month, currency_code, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'CAD', 'submitted'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1', '2026-11-01', 'CAD', 'submitted');

-- Acts as the scheduled jobs (secret key).
set local role service_role;

select is(
  (select count(*) from public.claim_notifications('daily_summary', 'ceo@test.local', array[null::uuid], array['2026-11-20'])),
  1::bigint, 'the first run claims today''s daily summary'
);
select is(
  (select count(*) from public.claim_notifications('daily_summary', 'ceo@test.local', array[null::uuid], array['2026-11-20'])),
  0::bigint, 'a second (or overlapping) run gets nothing to send'
);
select is(
  (select count(*) from public.claim_notifications('daily_summary', 'ceo@test.local', array[null::uuid], array['2026-11-21'])),
  1::bigint, 'the next day is a new period'
);

-- Per invoice: only invoices not yet claimed for that submission come back.
select is(
  (select count(*) from public.claim_notifications('overdue_alert', 'acc@test.local',
     array['10000000-0000-0000-0000-000000000001'::uuid], array['2026-10-28T10:00:00Z'])),
  1::bigint, 'an overdue alert is claimed for one submission'
);
select results_eq(
  $$ select claimed_invoice_id from public.claim_notifications('overdue_alert', 'acc@test.local',
       array['10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid],
       array['2026-10-28T10:00:00Z', '2026-11-03T10:00:00Z']) $$,
  $$ values ('10000000-0000-0000-0000-000000000002'::uuid) $$,
  'a later run only gets the invoice not alerted yet'
);
select is(
  (select count(*) from public.claim_notifications('overdue_alert', 'acc@test.local',
     array['10000000-0000-0000-0000-000000000001'::uuid], array['2026-11-10T10:00:00Z'])),
  1::bigint, 'a resubmission is a new period, so it can be alerted again'
);

-- A failed send frees the claim for the next run.
select public.finish_notifications(
  array(select id from public.notification_logs where type = 'daily_summary' and period = '2026-11-21'),
  'failed', 'subject', null, 'provider down');
select is(
  (select count(*) from public.claim_notifications('daily_summary', 'ceo@test.local', array[null::uuid], array['2026-11-21'])),
  1::bigint, 'after a failure the next run can try again'
);

-- A claim left pending by a crashed run is released after 10 minutes.
reset role;
update public.notification_logs set sent_at = now() - interval '11 minutes'
where type = 'daily_summary' and period = '2026-11-21' and status = 'pending';
set local role service_role;
select is(
  (select count(*) from public.claim_notifications('daily_summary', 'ceo@test.local', array[null::uuid], array['2026-11-21'])),
  1::bigint, 'an abandoned claim is released and retried'
);
reset role;

-- Nobody signed in can claim or finish.
set local role authenticated;
select throws_ok(
  $$ select * from public.claim_notifications('daily_summary', 'x@test.local', array[null::uuid], array['2026-11-22']) $$,
  '42501', null, 'signed-in users cannot claim notifications'
);
reset role;

select * from finish();
rollback;

-- Invoice core (M2): drafts, line maths, receipts, numbering, the status flow
-- and the audit trail, walked through one invoice's life. Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'ceo@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, name, email, employee_code, default_currency, timezone) values
  ('00000000-0000-0000-0000-0000000000e1', 'Employee One', 'e1@test.local', 'T001', 'LKR', 'Asia/Colombo'),
  ('00000000-0000-0000-0000-0000000000e2', 'Employee Two', 'e2@test.local', 'T002', 'CAD', 'America/Vancouver'),
  ('00000000-0000-0000-0000-0000000000c1', 'The CEO', 'ceo@test.local', null, null, 'America/Toronto');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'employee'),
  ('00000000-0000-0000-0000-0000000000e2', 'employee'),
  ('00000000-0000-0000-0000-0000000000c1', 'approver');

-- Acts as a signed-in user (or the secret key, uid null). Call after `reset role`.
create function pg_temp.act_as(uid uuid, aal text, jwt_role text default 'authenticated') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', jwt_role, 'aal', aal)::text, true);
  perform set_config('role', jwt_role, true);
end;
$$;

-- Invoice ids by name, readable whoever we act as.
create temp table ids (k text primary key, id uuid);
grant select on ids to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Monthly drafts
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select isnt(public.ensure_monthly_draft(null, '2026-10-15'), null, 'an employee can open their monthly draft');
reset role;
insert into ids select 'oct', id from public.invoices
  where employee_id = '00000000-0000-0000-0000-0000000000e1' and month = '2026-10-01';

select results_eq(
  $$ select status::text, currency_code from public.invoices where id = (select id from ids where k = 'oct') $$,
  $$ values ('draft', 'LKR') $$,
  'the draft is for the month, in the employee''s currency'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select is(public.ensure_monthly_draft(null, '2026-10-28'), (select id from ids where k = 'oct'),
  'opening it again returns the same invoice: one per month');
select throws_ok(
  $$ select public.ensure_monthly_draft('00000000-0000-0000-0000-0000000000e2', '2026-10-01') $$,
  '42501', null, 'an employee cannot create a draft for someone else'
);
reset role;

select pg_temp.act_as(null, 'aal1', 'service_role');
select lives_ok(
  $$ select public.ensure_monthly_draft('00000000-0000-0000-0000-0000000000e2', '2026-10-01') $$,
  'the monthly job can create drafts for employees'
);
reset role;
insert into ids select 'e2oct', id from public.invoices
  where employee_id = '00000000-0000-0000-0000-0000000000e2' and month = '2026-10-01';

select is(
  (select count(*) from public.approval_events where invoice_id = (select id from ids where k = 'oct') and action = 'create'),
  1::bigint, 'creating the draft is in the audit trail'
);

-- ---------------------------------------------------------------------------
-- Lines and maths (amounts in minor units: 25000000 = Rs 250,000.00)
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select lives_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, quantity, rate_minor, position)
     select (select id from ids where k = 'oct'), id, 'October professional fees', 1, 25000000, 0
     from public.line_types where name = 'Professional fees' $$,
  'an employee can add a line to their draft'
);
select lives_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, quantity, rate_minor, position)
     select (select id from ids where k = 'oct'), id, 'Taxi to client', 2.5, 1999, 1
     from public.line_types where name = 'Expense' $$,
  'an expense line with a part quantity'
);
select is(
  (select line_total_minor from public.line_items where description = 'Taxi to client'),
  4998::bigint, 'line amount is quantity x rate, rounded half-up to the currency''s smallest unit (2.5 x 19.99 = 49.98)'
);
select results_eq(
  $$ select subtotal_minor, tax_total_minor, total_minor from public.invoices where id = (select id from ids where k = 'oct') $$,
  $$ values (25004998::bigint, 0::bigint, 25004998::bigint) $$,
  'invoice totals follow the lines'
);
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor, tax_rate_id)
     select (select id from ids where k = 'oct'), lt.id, 'Taxed', 10000, tr.id
     from public.line_types lt, public.tax_rates tr where lt.name = 'Other' and tr.name = 'VAT 18%' $$,
  'P0001', 'That tax rate is switched off', 'tax rates cannot be used while switched off'
);
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
     select (select id from ids where k = 'oct'), id, '   ', 100 from public.line_types where name = 'Other' $$,
  'P0001', 'Each line needs a description', 'a line needs a description'
);
reset role;

-- The accountant switches VAT on.
update public.tax_rates set active = true where name = 'VAT 18%';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select lives_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor, tax_rate_id, position)
     select (select id from ids where k = 'oct'), lt.id, 'Taxed service', 10000, tr.id, 2
     from public.line_types lt, public.tax_rates tr where lt.name = 'Other' and tr.name = 'VAT 18%' $$,
  'an active tax rate can be used'
);
select results_eq(
  $$ select tax_minor from public.line_items where description = 'Taxed service' $$,
  $$ values (1800::bigint) $$,
  'tax is calculated per line: 18% of 100.00 = 18.00'
);
select results_eq(
  $$ select subtotal_minor, tax_total_minor, total_minor from public.invoices where id = (select id from ids where k = 'oct') $$,
  $$ values (25014998::bigint, 1800::bigint, 25016798::bigint) $$,
  'invoice shows subtotal, tax and total'
);
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor, tax_rate_id)
     select (select id from ids where k = 'oct'), lt.id, 'Wrong tax', 10000, tr.id
     from public.line_types lt, public.tax_rates tr where lt.name = 'Other' and tr.name = 'GST 5%' $$,
  'P0001', null, 'a CAD tax rate cannot be used on an LKR invoice'
);
reset role;
update public.tax_rates set active = true where name = 'GST 5%';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor, tax_rate_id)
     select (select id from ids where k = 'oct'), lt.id, 'Wrong tax', 10000, tr.id
     from public.line_types lt, public.tax_rates tr where lt.name = 'Other' and tr.name = 'GST 5%' $$,
  'P0001', 'That tax rate is for CAD invoices, not LKR', 'even when that CAD rate is switched on'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2', 'aal1');
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
     select (select id from ids where k = 'oct'), id, 'Sneaky', 100 from public.line_types where name = 'Other' $$,
  '42501', null, 'an employee cannot add lines to someone else''s invoice'
);
reset role;

select is(
  (select count(*) from public.approval_events where invoice_id = (select id from ids where k = 'oct') and action = 'line_add'),
  3::bigint, 'each added line is in the audit trail'
);

-- ---------------------------------------------------------------------------
-- Submitting: confirmation, receipts, numbering
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select throws_ok(
  $$ select public.submit_invoice((select id from ids where k = 'oct'), false) $$,
  'P0001', 'Tick "I confirm everything is correct" before submitting', 'nothing is sent until the employee confirms'
);
select throws_ok(
  $$ select public.submit_invoice((select id from ids where k = 'oct'), true) $$,
  'P0001', 'Attach a receipt for: Taxi to client', 'expenses need a receipt before submitting'
);
select throws_ok(
  $$ insert into public.attachments (line_item_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
     select id, 'somewhere/else/taxi.pdf', 'taxi.pdf', 'application/pdf', 20000, '00000000-0000-0000-0000-0000000000e1'
     from public.line_items where description = 'Taxi to client' $$,
  'P0001', null, 'attachments must live in the employee''s folder for this invoice'
);
select throws_ok(
  $$ insert into public.attachments (line_item_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
     select id, '00000000-0000-0000-0000-0000000000e1/' || (select id from ids where k = 'oct') || '/big.pdf',
            'big.pdf', 'application/pdf', 10485761, '00000000-0000-0000-0000-0000000000e1'
     from public.line_items where description = 'Taxi to client' $$,
  '23514', null, 'attachments over 10 MB are refused'
);
select lives_ok(
  $$ insert into public.attachments (line_item_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
     select id, '00000000-0000-0000-0000-0000000000e1/' || (select id from ids where k = 'oct') || '/taxi.pdf',
            'taxi.pdf', 'application/pdf', 20000, '00000000-0000-0000-0000-0000000000e1'
     from public.line_items where description = 'Taxi to client' $$,
  'an employee can attach a receipt'
);

-- The app forwards the browser's IP and user agent; the audit trail keeps them.
select set_config('request.headers', '{"x-client-ip": "203.0.113.7", "x-client-agent": "TestBrowser/1.0"}', true);
select is(public.submit_invoice((select id from ids where k = 'oct'), true), 'QN-T001-2026-10-001',
  'submitting assigns the first number: QN-EMP-YYYY-MM-NNN');
reset role;

select results_eq(
  $$ select status::text, (review_deadline - submitted_at) = interval '10 days', employee_confirmed_at is not null
     from public.invoices where id = (select id from ids where k = 'oct') $$,
  $$ values ('submitted', true, true) $$,
  'submitted, confirmed, review deadline 10 days after submission'
);
select results_eq(
  $$ select host(ip_address), user_agent from public.approval_events
     where invoice_id = (select id from ids where k = 'oct') and action = 'submit' $$,
  $$ values ('203.0.113.7', 'TestBrowser/1.0') $$,
  'the audit trail records who, from which IP and browser'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select throws_ok(
  $$ insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
     select (select id from ids where k = 'oct'), id, 'Late addition', 100 from public.line_types where name = 'Other' $$,
  'P0001', 'This invoice is submitted and can no longer be changed', 'a submitted invoice is locked'
);
select throws_ok(
  $$ select public.update_invoice_details((select id from ids where k = 'oct'), 'CAD', 'ref') $$,
  'P0001', null, 'its details are locked too'
);

-- ---------------------------------------------------------------------------
-- Recall before review; numbers are kept
-- ---------------------------------------------------------------------------

select lives_ok($$ select public.recall_invoice((select id from ids where k = 'oct')) $$,
  'an employee can recall before the CEO opens it');
select is(
  (select status::text from public.invoices where id = (select id from ids where k = 'oct')),
  'draft', 'a recalled invoice is a draft again'
);
select is(public.submit_invoice((select id from ids where k = 'oct'), true), 'QN-T001-2026-10-001',
  'resubmitting keeps the same number');
reset role;
select is(
  (select last_invoice_seq from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  1, 'no number was used up by the recall'
);

-- ---------------------------------------------------------------------------
-- Review, rejection and approval
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal1');
select throws_ok(
  $$ select public.open_for_review((select id from ids where k = 'oct')) $$,
  '42501', null, 'the CEO needs two-factor to review'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select lives_ok($$ select public.open_for_review((select id from ids where k = 'oct')) $$,
  'the CEO opens the invoice');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select throws_ok(
  $$ select public.recall_invoice((select id from ids where k = 'oct')) $$,
  'P0001', 'The CEO has started reviewing this invoice, so it can no longer be recalled',
  'once the CEO opens it, the employee cannot recall it'
);
select throws_ok(
  $$ select public.approve_invoices(array[(select id from ids where k = 'oct')]) $$,
  '42501', null, 'an employee cannot approve'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select throws_ok(
  $$ select public.reject_invoice((select id from ids where k = 'oct'), '  ') $$,
  'P0001', 'Say what needs fixing', 'a rejection needs a comment'
);
select lives_ok(
  $$ select public.reject_invoice((select id from ids where k = 'oct'), 'Add the taxi receipt total') $$,
  'the CEO rejects with a comment'
);
reset role;
select results_eq(
  $$ select comment, previous_status::text, new_status::text from public.approval_events
     where invoice_id = (select id from ids where k = 'oct') and action = 'reject' $$,
  $$ values ('Add the taxi receipt total', 'submitted', 'rejected') $$,
  'the rejection and its comment are in the audit trail'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select lives_ok(
  $$ update public.line_items set rate_minor = 2099 where description = 'Taxi to client' $$,
  'a rejected invoice can be fixed'
);
select is(public.submit_invoice((select id from ids where k = 'oct'), true), 'QN-T001-2026-10-001',
  'and resubmitted with the same number');
reset role;
select is(
  (select count(*) from public.approval_events where invoice_id = (select id from ids where k = 'oct') and action = 'resubmit'),
  2::bigint, 'both resubmissions are in the audit trail'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select throws_ok(
  $$ select public.approve_invoices(array[(select id from ids where k = 'oct'), (select id from ids where k = 'e2oct')]) $$,
  'P0001', null, 'bulk approval is all or none: one draft in the batch stops it'
);
select is(
  (select status::text from public.invoices where id = (select id from ids where k = 'oct')),
  'submitted', 'so nothing was approved'
);
select is(public.approve_invoices(array[(select id from ids where k = 'oct')]), 1, 'the CEO approves');
reset role;

-- ---------------------------------------------------------------------------
-- Payment
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2', 'aal1');
select throws_ok(
  $$ select public.mark_invoices_paid(array[(select id from ids where k = 'oct')]) $$,
  'P0002', null, 'an employee cannot mark someone else''s invoice paid'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select is(public.mark_invoices_paid(array[(select id from ids where k = 'oct')], 24900000), 1,
  'the employee marks it paid with the amount received');
reset role;
select results_eq(
  $$ select i.status::text, i.marked_paid_by::text, p.amount_received_minor, p.received_currency
     from public.invoices i join public.payments p on p.invoice_id = i.id
     where i.id = (select id from ids where k = 'oct') $$,
  $$ values ('paid', 'employee', 24900000::bigint, 'LKR') $$,
  'paid, by the employee, amount recorded'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select throws_ok(
  $$ select public.mark_invoices_paid(array[(select id from ids where k = 'oct')]) $$,
  'P0001', null, 'an invoice cannot be marked paid twice'
);
reset role;

-- ---------------------------------------------------------------------------
-- Next month: pre-filled draft, running number
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select lives_ok($$ select public.ensure_monthly_draft(null, '2026-11-01') $$, 'November''s draft opens');
reset role;
insert into ids select 'nov', id from public.invoices
  where employee_id = '00000000-0000-0000-0000-0000000000e1' and month = '2026-11-01';

select results_eq(
  $$ select description, rate_minor from public.line_items where invoice_id = (select id from ids where k = 'nov') $$,
  $$ values ('October professional fees', 25000000::bigint) $$,
  'it is pre-filled with the usual professional fees line'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1', 'aal1');
select is(public.submit_invoice((select id from ids where k = 'nov'), true), 'QN-T001-2026-11-002',
  'the running number goes up by one and does not restart');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select lives_ok($$ select public.approve_invoices(array[(select id from ids where k = 'nov')]) $$, 'approved');
select is(public.mark_invoices_paid(array[(select id from ids where k = 'nov')]), 1, 'the CEO can mark it paid');
reset role;
select is(
  (select marked_paid_by::text from public.invoices where id = (select id from ids where k = 'nov')),
  'approver', 'recorded as marked paid by the CEO'
);

-- An employee without a code cannot get a number.
update public.profiles set employee_code = null where id = '00000000-0000-0000-0000-0000000000e2';
insert into public.line_items (invoice_id, line_type_id, description, rate_minor)
select (select id from ids where k = 'e2oct'), id, 'Fees', 500000 from public.line_types where name = 'Professional fees';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2', 'aal1');
select throws_ok(
  $$ select public.submit_invoice((select id from ids where k = 'e2oct'), true) $$,
  'P0001', 'Your employee code is not set yet. Ask the admin to add it.', 'numbers need the employee code'
);
reset role;

select * from finish();
rollback;

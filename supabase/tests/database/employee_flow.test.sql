-- Employee flow (M3): "My reference" on any invoice, and deleting a line
-- together with its receipts. Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code, default_currency) values
  ('00000000-0000-0000-0000-0000000000e1', 'Employee One', 'e1@test.local', 'T001', 'CAD'),
  ('00000000-0000-0000-0000-0000000000e2', 'Employee Two', 'e2@test.local', 'T002', 'CAD');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'employee'),
  ('00000000-0000-0000-0000-0000000000e2', 'employee');

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into public.invoices (id, employee_id, month, currency_code) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'CAD');
insert into public.line_items (id, invoice_id, line_type_id, description, rate_minor)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', id, 'Figma', 2499
from public.line_types where name = 'App fee';
insert into public.attachments (line_item_id, storage_path, file_name, mime_type, size_bytes, uploaded_by) values
  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000e1/10000000-0000-0000-0000-000000000001/figma.pdf',
   'figma.pdf', 'application/pdf', 1000, '00000000-0000-0000-0000-0000000000e1');

-- Deleting a line with a receipt --------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ delete from public.line_items where id = '20000000-0000-0000-0000-000000000001' $$,
  'an employee can delete a line that has a receipt'
);
reset role;
select is(
  (select count(*) from public.attachments where line_item_id = '20000000-0000-0000-0000-000000000001'),
  0::bigint, 'its receipts go with it'
);
select is(
  (select count(*) from public.approval_events
   where invoice_id = '10000000-0000-0000-0000-000000000001' and action = 'line_remove'),
  1::bigint, 'the removal is in the audit trail'
);

-- My reference, whatever the status -----------------------------------------

update public.invoices set status = 'paid' where id = '10000000-0000-0000-0000-000000000001';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ select public.set_invoice_reference('10000000-0000-0000-0000-000000000001', '  Oct batch  ') $$,
  'an employee can set My reference on a paid invoice'
);
reset role;
select is(
  (select employee_reference from public.invoices where id = '10000000-0000-0000-0000-000000000001'),
  'Oct batch', 'the reference is trimmed and saved'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ select public.set_invoice_reference('10000000-0000-0000-0000-000000000001', 'mine now') $$,
  'P0002', null, 'but not on someone else''s invoice'
);
select throws_ok(
  $$ select public.update_invoice_details('10000000-0000-0000-0000-000000000001', 'LKR', 'x') $$,
  'P0002', null, 'and nobody can change the currency of another person''s invoice'
);
reset role;

select * from finish();
rollback;

-- Employee codes come from the system, and only people with the employee role
-- get one. Run with `pnpm test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Start from no codes at all, whatever the local database holds.
update public.profiles set employee_code = null;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c5', 'c5@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, name, email, employee_code) values
  ('00000000-0000-0000-0000-0000000000c1', 'First', 'c1@test.local', null),
  ('00000000-0000-0000-0000-0000000000c2', 'Second', 'c2@test.local', null),
  ('00000000-0000-0000-0000-0000000000c3', 'Staff', 'c3@test.local', null),
  ('00000000-0000-0000-0000-0000000000c4', 'Old code', 'c4@test.local', 'T001'),
  ('00000000-0000-0000-0000-0000000000c5', 'Invoiced', 'c5@test.local', null);

create function pg_temp.code_of(uid uuid) returns text language sql as $$
  select employee_code from public.profiles where id = uid;
$$;

-- Given when the employee role is added, in order.
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c1'), 'E001', 'the first employee gets E001');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c2', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c2'), 'E002', 'the next employee gets E002');

-- Other roles get none.
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c3', 'approver'),
  ('00000000-0000-0000-0000-0000000000c3', 'admin');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c3'), null, 'approvers and admins get no code');

-- A second role doesn't change a code.
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'accounts');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c1'), 'E001', 'adding another role keeps the code');

-- Codes already in use stay, and numbering continues from the highest.
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c4', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c4'), 'T001', 'an existing code is not replaced');
update public.profiles set employee_code = 'E014' where id = '00000000-0000-0000-0000-0000000000c2';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c3', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c3'), 'E015', 'numbering continues after the highest code');

-- Taking the role away frees a code that never reached an invoice number.
delete from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000c3' and role = 'employee';
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c3'), null, 'an unused code is removed with the role');

-- Taking away a different role leaves the code alone.
delete from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'accounts';
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c1'), 'E001', 'removing another role keeps the code');

-- A code in an invoice number stays, so old invoices keep showing it.
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c5', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c5'), 'E015', 'a code nobody holds or invoiced can be given again');
insert into public.invoices (employee_id, month, currency_code, status, number)
values ('00000000-0000-0000-0000-0000000000c5', '2026-10-01', 'LKR', 'submitted', 'QN-E015-2026-10-001');
delete from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000c5' and role = 'employee';
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c5'), 'E015', 'a code used on an invoice stays after the role goes');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c5', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c5'), 'E015', 'coming back as an employee keeps the same code');

-- Past E999 the code just gets longer.
update public.profiles set employee_code = 'E999' where id = '00000000-0000-0000-0000-0000000000c2';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c3', 'employee');
select is(pg_temp.code_of('00000000-0000-0000-0000-0000000000c3'), 'E1000', 'E999 is followed by E1000');

select * from finish();
rollback;

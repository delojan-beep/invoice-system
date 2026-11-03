-- Employee codes are given by the system, and only to people with the employee
-- role: E001, E002, ... continuing from the highest code in use. Existing codes
-- never change, because they are already in invoice numbers.

create function private.give_employee_code(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  next_number integer;
begin
  -- One at a time, so two people added together can't get the same code.
  perform pg_advisory_xact_lock(hashtext('employee_code'));

  select coalesce(max(substring(employee_code from 2)::integer), 0) + 1 into next_number
  from public.profiles
  where employee_code ~ '^E[0-9]+$';

  update public.profiles
  set employee_code = 'E' || lpad(next_number::text, greatest(3, length(next_number::text)), '0')
  where id = p_user and employee_code is null;
end;
$$;

-- Someone who is employee again later keeps the code they still hold.
create function private.employee_role_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.give_employee_code(new.user_id);
  return new;
end;
$$;

create trigger user_roles_employee_added after insert on public.user_roles
  for each row when (new.role = 'employee') execute function private.employee_role_added();

-- A code that reached an invoice number stays, so old invoices and exports keep showing it.
create function private.employee_role_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set employee_code = null
  where p.id = old.user_id
    and not exists (select 1 from public.invoices i where i.employee_id = p.id and i.number is not null);
  return old;
end;
$$;

create trigger user_roles_employee_removed after delete on public.user_roles
  for each row when (old.role = 'employee') execute function private.employee_role_removed();

-- People already in the system: same rules, oldest first.
update public.profiles p
set employee_code = null
where p.employee_code is not null
  and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'employee')
  and not exists (select 1 from public.invoices i where i.employee_id = p.id and i.number is not null);

do $$
declare
  person uuid;
begin
  for person in
    select p.id
    from public.profiles p
    join public.user_roles r on r.user_id = p.id and r.role = 'employee'
    where p.employee_code is null
    order by p.created_at, p.id
  loop
    perform private.give_employee_code(person);
  end loop;
end;
$$;

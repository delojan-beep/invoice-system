-- Staff (approver, accounts, admin, all with two-factor) need to know who the
-- employees are: the accounts filter, names in the queue, reports.
-- Employees still see only their own roles.

create policy "staff read roles" on public.user_roles
  for select to authenticated using (public.is_staff());

-- The pre-filled professional fees line kept last month's wording, so a December draft
-- read "October consulting". Swap the earlier month's name and year for the new month's.

create or replace function private.reword_month(p_text text, p_from date, p_to date)
returns text
language sql immutable set search_path = '' as $$
  -- The year only moves when the text names the month, so "Dec 2025 review" is left alone.
  select case
    when p_text ~ ('\m' || to_char(p_from, 'FMMonth') || '\M') then
      regexp_replace(
        regexp_replace(p_text, '\m' || to_char(p_from, 'FMMonth') || '\M', to_char(p_to, 'FMMonth'), 'g'),
        '\m' || to_char(p_from, 'YYYY') || '\M', to_char(p_to, 'YYYY'), 'g')
    else p_text
  end;
$$;

create or replace function public.ensure_monthly_draft(p_employee uuid default null, p_month date default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_employee uuid := coalesce(p_employee, auth.uid());
  v_month date;
  v_invoice uuid;
  v_fees_type uuid;
  emp record;
  last_fee record;
begin
  if not (v_employee = auth.uid() or private.is_system()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select p.status, p.default_currency, p.timezone,
         exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'employee') as is_employee
  into emp from public.profiles p where p.id = v_employee;

  if emp.status is distinct from 'active' or not emp.is_employee then
    raise exception 'Only active employees have monthly invoices' using errcode = 'P0001';
  end if;
  if emp.default_currency is null then
    raise exception 'No default currency is set. Ask the admin to add one.' using errcode = 'P0001';
  end if;

  -- "This month" is the employee's own month, in their timezone.
  v_month := coalesce(date_trunc('month', p_month)::date,
                      date_trunc('month', now() at time zone emp.timezone)::date);

  select i.id into v_invoice from public.invoices i where i.employee_id = v_employee and i.month = v_month;
  if v_invoice is not null then
    return v_invoice;
  end if;

  perform private.begin_action('create', null);
  insert into public.invoices (employee_id, month, currency_code)
  values (v_employee, v_month, emp.default_currency)
  on conflict (employee_id, month) do nothing
  returning id into v_invoice;

  if v_invoice is null then -- created by a concurrent call
    select i.id into v_invoice from public.invoices i where i.employee_id = v_employee and i.month = v_month;
    return v_invoice;
  end if;

  -- Pre-fill the usual professional fees line from the latest earlier invoice in the same currency.
  select lt.id into v_fees_type from public.line_types lt where lt.name = 'Professional fees' and lt.active;
  select li.description, li.quantity, li.rate_minor, i.month as last_month into last_fee
  from public.line_items li join public.invoices i on i.id = li.invoice_id
  where i.employee_id = v_employee and i.month < v_month
    and i.currency_code = emp.default_currency and li.line_type_id = v_fees_type
  order by i.month desc, li.position
  limit 1;

  if v_fees_type is not null and last_fee.description is not null then
    insert into public.line_items (invoice_id, line_type_id, description, quantity, rate_minor, position)
    values (v_invoice, v_fees_type, private.reword_month(last_fee.description, last_fee.last_month, v_month), last_fee.quantity, last_fee.rate_minor, 0);
  end if;

  return v_invoice;
end;
$$;

-- QNetwork Invoice System: invoice core (milestone M2).
-- Status changes, numbering, line maths, receipts and the audit trail all live
-- here so the rules hold for every caller: screens, scheduled jobs and scripts.
--
-- Status flow:  draft -> submitted -> approved -> paid
--                          |   ^
--               recall     |   | resubmit
--               (before    v   |
--                review)  draft / rejected
--
-- Callers write invoices only through the public functions below. Line items
-- and attachments are written directly (row-level security + triggers).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.settings where key = p_key;
$$;

-- Scheduled jobs and scripts call with the secret key, which signs as service_role.
create function private.is_system() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- The app forwards the browser's IP and user agent as x-client-ip / x-client-agent.
create function private.request_header(p_name text) returns text
language plpgsql stable set search_path = '' as $$
declare
  headers json;
begin
  headers := nullif(current_setting('request.headers', true), '')::json;
  return nullif(trim(headers ->> p_name), '');
exception when others then
  return null;
end;
$$;

create function private.client_ip() returns inet
language plpgsql stable set search_path = '' as $$
begin
  return coalesce(
    private.request_header('x-client-ip'),
    split_part(private.request_header('x-forwarded-for'), ',', 1)
  )::inet;
exception when others then
  return null;
end;
$$;

-- Editable means the employee may still change lines and attachments.
create function private.is_editable(p_status public.invoice_status) returns boolean
language sql immutable as $$
  select p_status in ('draft', 'rejected');
$$;

-- ---------------------------------------------------------------------------
-- Audit trail
-- Every change to an invoice, its lines or attachments writes one event.
-- The public functions name the action (and comment) through two
-- transaction-local settings; anything else is logged as a generic change.
-- ---------------------------------------------------------------------------

create function private.audit(
  p_invoice uuid,
  p_action text,
  p_previous public.invoice_status,
  p_new public.invoice_status,
  p_comment text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.approval_events
    (invoice_id, actor_id, action, previous_status, new_status, comment, system_note, ip_address, user_agent)
  values
    (p_invoice, auth.uid(), p_action, p_previous, p_new, p_comment, p_note,
     private.client_ip(),
     coalesce(private.request_header('x-client-agent'), private.request_header('user-agent')));
end;
$$;

create function private.begin_action(p_action text, p_comment text default null) returns void
language plpgsql set search_path = '' as $$
begin
  perform set_config('app.audit_action', p_action, true);
  perform set_config('app.audit_comment', coalesce(p_comment, ''), true);
end;
$$;

create function private.audit_invoice_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  action text := nullif(current_setting('app.audit_action', true), '');
  comment text := nullif(current_setting('app.audit_comment', true), '');
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.audit(new.id, coalesce(action, 'create'), null, new.status, comment, null);
    return null;
  end if;

  if new.status is distinct from old.status then changed := array_append(changed, 'status'); end if;
  if new.number is distinct from old.number then changed := array_append(changed, 'number'); end if;
  if new.currency_code is distinct from old.currency_code then changed := array_append(changed, 'currency'); end if;
  if new.employee_reference is distinct from old.employee_reference then changed := array_append(changed, 'reference'); end if;
  if new.review_started_at is distinct from old.review_started_at then changed := array_append(changed, 'review started'); end if;

  -- Totals follow line changes, which are logged on their own.
  if cardinality(changed) = 0 then
    return null;
  end if;

  perform private.audit(new.id, coalesce(action, 'update'), old.status, new.status, comment,
    'changed: ' || array_to_string(changed, ', '));
  return null;
end;
$$;

create trigger invoices_audit after insert or update on public.invoices
  for each row execute function private.audit_invoice_change();

-- ---------------------------------------------------------------------------
-- Line items: maths, locking and totals
-- Amounts are integer minor units, so rounding to whole minor units is
-- rounding to the currency's decimal places. Rounding is half-up.
--   line_total_minor = round(quantity x rate)      (before tax)
--   tax_minor        = round(line_total x tax %)
--   invoice subtotal = sum(line_total), tax = sum(tax), total = subtotal + tax
-- ---------------------------------------------------------------------------

create function private.compute_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  rate record;
  pct numeric := 0;
begin
  select status, currency_code into inv from public.invoices where id = new.invoice_id;

  if not private.is_editable(inv.status) then
    raise exception 'This invoice is % and can no longer be changed', inv.status
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    raise exception 'A line cannot move to another invoice' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' or new.line_type_id is distinct from old.line_type_id then
    if not exists (select 1 from public.line_types where id = new.line_type_id and active) then
      raise exception 'That line type is not available' using errcode = 'P0001';
    end if;
  end if;

  if new.tax_rate_id is not null then
    select percentage, currency_code, active into rate from public.tax_rates where id = new.tax_rate_id;
    if not found or not rate.active then
      raise exception 'That tax rate is switched off' using errcode = 'P0001';
    end if;
    if rate.currency_code <> inv.currency_code then
      raise exception 'That tax rate is for % invoices, not %', rate.currency_code, inv.currency_code
        using errcode = 'P0001';
    end if;
    pct := rate.percentage;
  end if;

  new.description := trim(new.description);
  if new.description = '' then
    raise exception 'Each line needs a description' using errcode = 'P0001';
  end if;

  new.line_total_minor := round(new.quantity * new.rate_minor);
  new.tax_minor := round(new.line_total_minor * pct / 100);
  return new;
end;
$$;

create trigger line_items_compute before insert or update on public.line_items
  for each row execute function private.compute_line();

create function private.recalc_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.invoices i
  set subtotal_minor = coalesce(t.subtotal, 0),
      tax_total_minor = coalesce(t.tax, 0),
      total_minor = coalesce(t.subtotal, 0) + coalesce(t.tax, 0)
  from (
    select sum(line_total_minor) as subtotal, sum(tax_minor) as tax
    from public.line_items where invoice_id = p_invoice
  ) t
  where i.id = p_invoice;
end;
$$;

create function private.after_line_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line public.line_items := coalesce(new, old);
  inv_status public.invoice_status;
begin
  -- Deleting a line on a locked invoice is blocked here (inserts and updates in compute_line).
  select status into inv_status from public.invoices where id = line.invoice_id;
  if tg_op = 'DELETE' and not private.is_editable(inv_status) then
    raise exception 'This invoice is % and can no longer be changed', inv_status using errcode = 'P0001';
  end if;

  perform private.recalc_invoice(line.invoice_id);
  perform private.audit(
    line.invoice_id,
    case tg_op when 'INSERT' then 'line_add' when 'UPDATE' then 'line_update' else 'line_remove' end,
    inv_status, inv_status, null,
    format('%s: %s x %s = %s', line.description, line.quantity, line.rate_minor, line.line_total_minor)
  );
  return null;
end;
$$;

create trigger line_items_after after insert or update or delete on public.line_items
  for each row execute function private.after_line_change();

-- Employees write lines on their own editable invoices.
create policy "employees add lines to own editable invoices" on public.line_items
  for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.employee_id = auth.uid()
      and private.is_editable(i.status) and public.is_active_user()
  ));

create policy "employees change lines on own editable invoices" on public.line_items
  for update to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.employee_id = auth.uid()
      and private.is_editable(i.status) and public.is_active_user()
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.employee_id = auth.uid()
      and private.is_editable(i.status) and public.is_active_user()
  ));

create policy "employees remove lines from own editable invoices" on public.line_items
  for delete to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.employee_id = auth.uid()
      and private.is_editable(i.status) and public.is_active_user()
  ));

-- private.is_editable is called inside policies, so authenticated needs to reach it.
-- (Function access in this schema is locked down at the end of the file.)
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Attachments: receipts and invoices for lines, in private storage
-- Storage path: <employee id>/<invoice id>/<file name>
-- ---------------------------------------------------------------------------

create function private.guard_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  att public.attachments := coalesce(new, old);
  inv record;
begin
  select i.id, i.status, i.employee_id into inv
  from public.line_items li join public.invoices i on i.id = li.invoice_id
  where li.id = att.line_item_id;

  if not private.is_editable(inv.status) then
    raise exception 'This invoice is % and can no longer be changed', inv.status using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and new.storage_path not like inv.employee_id || '/' || inv.id || '/%' then
    raise exception 'Attachment path must be <employee>/<invoice>/<file>' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    perform private.audit(inv.id, 'attachment_add', inv.status, inv.status, null, new.file_name);
    return new;
  end if;
  perform private.audit(inv.id, 'attachment_remove', inv.status, inv.status, null, old.file_name);
  return old;
end;
$$;

create trigger attachments_guard before insert or delete on public.attachments
  for each row execute function private.guard_attachment();

create policy "employees attach files to own editable lines" on public.attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.line_items li join public.invoices i on i.id = li.invoice_id
      where li.id = line_item_id and i.employee_id = auth.uid() and private.is_editable(i.status)
    )
  );

create policy "employees remove files from own editable lines" on public.attachments
  for delete to authenticated
  using (exists (
    select 1 from public.line_items li join public.invoices i on i.id = li.invoice_id
    where li.id = line_item_id and i.employee_id = auth.uid() and private.is_editable(i.status)
  ));

-- Storage objects: employees upload into their own folder for an editable invoice;
-- owners and staff can read; owners can delete while editable.
create policy "employees upload attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
    and exists (
      select 1 from public.invoices i
      where i.id::text = (storage.foldername(name))[2]
        and i.employee_id = auth.uid() and private.is_editable(i.status)
    )
  );

create policy "owners and staff read attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()) or public.is_staff())
  );

create policy "employees delete attachments while editable" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.invoices i
      where i.id::text = (storage.foldername(name))[2]
        and i.employee_id = auth.uid() and private.is_editable(i.status)
    )
  );

create policy "owners and staff read invoice pdfs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoice-pdfs'
    and (((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()) or public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- Invoice numbers: QN-EMP-YYYY-MM-NNN (format from settings)
-- NNN is the employee's own running number. It is taken on first submit,
-- under a row lock, so numbers never repeat or skip.
-- ---------------------------------------------------------------------------

create function private.format_invoice_number(p_format text, p_code text, p_month date, p_seq integer)
returns text
language sql immutable as $$
  select replace(replace(replace(replace(p_format,
    '{EMP}', p_code),
    '{YYYY}', to_char(p_month, 'YYYY')),
    '{MM}', to_char(p_month, 'MM')),
    '{NNN}', lpad(p_seq::text, 3, '0'));
$$;

create function private.next_invoice_number(p_employee uuid, p_month date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
  seq integer;
begin
  update public.profiles
  set last_invoice_seq = last_invoice_seq + 1
  where id = p_employee
  returning employee_code, last_invoice_seq into code, seq;

  if code is null then
    raise exception 'Your employee code is not set yet. Ask the admin to add it.' using errcode = 'P0001';
  end if;

  return private.format_invoice_number(
    coalesce(private.setting('invoice_number_format') #>> '{}', 'QN-{EMP}-{YYYY}-{MM}-{NNN}'),
    code, p_month, seq);
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions (called through supabase.rpc)
-- ---------------------------------------------------------------------------

-- Locks an invoice row and checks the caller owns it.
create function private.lock_own_invoice(p_invoice uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice for update;
  if inv.id is null or inv.employee_id is distinct from auth.uid() then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is inactive' using errcode = 'P0001';
  end if;
  return inv;
end;
$$;

-- Creates this month's draft for an employee if they have no invoice for it yet,
-- pre-filled with their currency and last month's professional fees line.
-- Called by the employee (for themselves) or by the monthly job.
create function public.ensure_monthly_draft(p_employee uuid default null, p_month date default null)
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
  select li.description, li.quantity, li.rate_minor into last_fee
  from public.line_items li join public.invoices i on i.id = li.invoice_id
  where i.employee_id = v_employee and i.month < v_month
    and i.currency_code = emp.default_currency and li.line_type_id = v_fees_type
  order by i.month desc, li.position
  limit 1;

  if v_fees_type is not null and last_fee.description is not null then
    insert into public.line_items (invoice_id, line_type_id, description, quantity, rate_minor, position)
    values (v_invoice, v_fees_type, last_fee.description, last_fee.quantity, last_fee.rate_minor, 0);
  end if;

  return v_invoice;
end;
$$;

-- Header fields the employee may change while editable.
create function public.update_invoice_details(p_invoice uuid, p_currency text, p_reference text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices := private.lock_own_invoice(p_invoice);
begin
  if not private.is_editable(inv.status) then
    raise exception 'This invoice is % and can no longer be changed', inv.status using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.currencies where code = p_currency and active) then
    raise exception 'That currency is not available' using errcode = 'P0001';
  end if;

  perform private.begin_action('update', null);
  update public.invoices
  set currency_code = p_currency,
      employee_reference = nullif(trim(p_reference), '')
  where id = p_invoice;

  -- Tax rates belong to one currency; drop any that no longer match.
  if p_currency <> inv.currency_code then
    update public.line_items set tax_rate_id = null
    where invoice_id = p_invoice and tax_rate_id is not null;
  end if;
end;
$$;

-- Employee confirms and submits (or resubmits after rejection or recall).
create function public.submit_invoice(p_invoice uuid, p_confirmed boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices := private.lock_own_invoice(p_invoice);
  missing text;
  base text := coalesce(private.setting('base_currency') #>> '{}', 'CAD');
  days integer := coalesce((private.setting('review_period_days') #>> '{}')::integer, 10);
  fx numeric;
  v_number text := inv.number;
begin
  if not private.is_editable(inv.status) then
    raise exception 'This invoice is already %', inv.status using errcode = 'P0001';
  end if;
  if p_confirmed is not true then
    raise exception 'Tick "I confirm everything is correct" before submitting' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.line_items where invoice_id = p_invoice) then
    raise exception 'Add at least one line before submitting' using errcode = 'P0001';
  end if;
  if inv.total_minor <= 0 then
    raise exception 'The invoice total must be more than zero' using errcode = 'P0001';
  end if;

  select string_agg(li.description, ', ' order by li.position, li.created_at) into missing
  from public.line_items li join public.line_types lt on lt.id = li.line_type_id
  where li.invoice_id = p_invoice and lt.receipt_required
    and not exists (select 1 from public.attachments a where a.line_item_id = li.id);
  if missing is not null then
    raise exception 'Attach a receipt for: %', missing using errcode = 'P0001';
  end if;

  -- Resubmissions keep the number they were given the first time.
  if v_number is null then
    v_number := private.next_invoice_number(inv.employee_id, inv.month);
  end if;

  if inv.currency_code = base then
    fx := 1;
  else
    select rate into fx from public.exchange_rates
    where from_currency = inv.currency_code and to_currency = base
      and rate_date <= (now() at time zone 'UTC')::date
    order by rate_date desc limit 1;
  end if;

  perform private.begin_action(case when inv.status = 'rejected' or inv.recalled_at is not null
                                    then 'resubmit' else 'submit' end, null);
  update public.invoices
  set status = 'submitted',
      number = v_number,
      employee_confirmed_at = now(),
      submitted_at = now(),
      review_started_at = null,
      review_deadline = now() + make_interval(days => days),
      exchange_rate_to_base = fx
  where id = p_invoice;

  return v_number;
end;
$$;

-- Employee pulls a submitted invoice back to draft, until the CEO opens it.
create function public.recall_invoice(p_invoice uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices := private.lock_own_invoice(p_invoice);
begin
  if inv.status <> 'submitted' then
    raise exception 'Only a submitted invoice can be recalled' using errcode = 'P0001';
  end if;
  if inv.review_started_at is not null then
    raise exception 'The CEO has started reviewing this invoice, so it can no longer be recalled'
      using errcode = 'P0001';
  end if;

  perform private.begin_action('recall', null);
  update public.invoices
  set status = 'draft', recalled_at = now(), review_deadline = null
  where id = p_invoice;
end;
$$;

-- The CEO opening an invoice locks it against recall.
create function public.open_for_review(p_invoice uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('approver') then
    raise exception 'Only the approver can review invoices' using errcode = '42501';
  end if;

  perform private.begin_action('review_start', null);
  update public.invoices
  set review_started_at = now()
  where id = p_invoice and status = 'submitted' and review_started_at is null;
end;
$$;

-- Approves one or several submitted invoices; all or none.
create function public.approve_invoices(p_invoices uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  not_ready text;
  updated integer;
begin
  if not public.has_role('approver') then
    raise exception 'Only the approver can approve invoices' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_invoices), 0) = 0 then
    raise exception 'Choose at least one invoice' using errcode = 'P0001';
  end if;

  perform 1 from public.invoices where id = any (p_invoices) order by id for update;

  select string_agg(coalesce(number, id::text), ', ') into not_ready
  from public.invoices where id = any (p_invoices) and status <> 'submitted';
  if not_ready is not null then
    raise exception 'These invoices are not waiting for approval: %', not_ready using errcode = 'P0001';
  end if;

  perform private.begin_action('approve', null);
  update public.invoices
  set status = 'approved', approved_at = now(), review_started_at = coalesce(review_started_at, now())
  where id = any (p_invoices);
  get diagnostics updated = row_count;

  if updated <> cardinality(array(select distinct unnest(p_invoices))) then
    raise exception 'Some invoices were not found' using errcode = 'P0002';
  end if;
  return updated;
end;
$$;

-- Sends an invoice back to the employee with a comment.
create function public.reject_invoice(p_invoice uuid, p_comment text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
begin
  if not public.has_role('approver') then
    raise exception 'Only the approver can reject invoices' using errcode = '42501';
  end if;
  if nullif(trim(p_comment), '') is null then
    raise exception 'Say what needs fixing' using errcode = 'P0001';
  end if;

  select * into inv from public.invoices where id = p_invoice for update;
  if inv.id is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'submitted' then
    raise exception 'Only a submitted invoice can be rejected' using errcode = 'P0001';
  end if;

  perform private.begin_action('reject', trim(p_comment));
  update public.invoices
  set status = 'rejected', rejected_at = now(), review_deadline = null, review_started_at = null
  where id = p_invoice;
end;
$$;

-- Records that approved invoices were paid in Wise. The approver can mark
-- several at once; an employee marks their own and may add the amount received.
create function public.mark_invoices_paid(
  p_invoices uuid[],
  p_amount_received_minor bigint default null,
  p_received_currency text default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  is_approver boolean := public.has_role('approver');
  not_allowed text;
  inv public.invoices;
  updated integer := 0;
begin
  if coalesce(cardinality(p_invoices), 0) = 0 then
    raise exception 'Choose at least one invoice' using errcode = 'P0001';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is inactive' using errcode = 'P0001';
  end if;
  if p_amount_received_minor is not null and p_amount_received_minor < 0 then
    raise exception 'The amount received cannot be negative' using errcode = 'P0001';
  end if;

  perform 1 from public.invoices where id = any (p_invoices) order by id for update;

  if not is_approver then
    select string_agg(coalesce(number, id::text), ', ') into not_allowed
    from public.invoices where id = any (p_invoices) and employee_id <> auth.uid();
    if not_allowed is not null then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
  end if;

  select string_agg(coalesce(number, id::text) || ' (' || status || ')', ', ') into not_allowed
  from public.invoices where id = any (p_invoices) and status <> 'approved';
  if not_allowed is not null then
    raise exception 'Only approved invoices can be marked paid: %', not_allowed using errcode = 'P0001';
  end if;

  perform private.begin_action('mark_paid', null);
  for inv in select * from public.invoices where id = any (p_invoices) loop
    update public.invoices
    set status = 'paid', paid_at = now(),
        marked_paid_by = case when inv.employee_id = auth.uid() then 'employee' else 'approver' end::public.paid_marker
    where id = inv.id;

    insert into public.payments (invoice_id, amount_received_minor, received_currency, paid_at, recorded_by)
    values (inv.id, p_amount_received_minor,
            case when p_amount_received_minor is null then null else coalesce(p_received_currency, inv.currency_code) end,
            now(), auth.uid());
    updated := updated + 1;
  end loop;

  if updated <> cardinality(array(select distinct unnest(p_invoices))) then
    raise exception 'Some invoices were not found' using errcode = 'P0002';
  end if;
  return updated;
end;
$$;

-- Internal helpers: nobody calls these directly. Postgres lets everyone run a
-- new function by default, so take that back and allow only what policies need.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_editable(public.invoice_status) to authenticated;

-- Only signed-in users (and the secret key) may call the actions.
revoke execute on function public.ensure_monthly_draft(uuid, date) from public, anon;
revoke execute on function public.update_invoice_details(uuid, text, text) from public, anon;
revoke execute on function public.submit_invoice(uuid, boolean) from public, anon;
revoke execute on function public.recall_invoice(uuid) from public, anon;
revoke execute on function public.open_for_review(uuid) from public, anon;
revoke execute on function public.approve_invoices(uuid[]) from public, anon;
revoke execute on function public.reject_invoice(uuid, text) from public, anon;
revoke execute on function public.mark_invoices_paid(uuid[], bigint, text) from public, anon;
grant execute on function public.ensure_monthly_draft(uuid, date) to authenticated, service_role;
grant execute on function public.update_invoice_details(uuid, text, text) to authenticated;
grant execute on function public.submit_invoice(uuid, boolean) to authenticated;
grant execute on function public.recall_invoice(uuid) to authenticated;
grant execute on function public.open_for_review(uuid) to authenticated;
grant execute on function public.approve_invoices(uuid[]) to authenticated;
grant execute on function public.reject_invoice(uuid, text) to authenticated;
grant execute on function public.mark_invoices_paid(uuid[], bigint, text) to authenticated;

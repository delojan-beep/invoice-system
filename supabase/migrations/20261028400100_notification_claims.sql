-- Send-once guarantee for scheduled emails (M5).
-- Before sending, a job claims the email in the log under a period key:
--   daily summary   -> the CEO's local date   ("2026-11-20")
--   monthly summary -> the local month        ("2026-11")
--   deadline/overdue per invoice -> that submission's time
-- A unique index lets only one claim exist per (type, recipient, period,
-- invoice), so two overlapping cron runs cannot both send. A failed send
-- frees the claim for the next run; a claim abandoned by a crashed run is
-- released after 10 minutes.

alter table public.notification_logs
  add column period text,
  drop constraint notification_logs_status,
  add constraint notification_logs_status check (status in ('pending', 'sent', 'failed', 'skipped'));

create unique index notification_logs_once on public.notification_logs
  (type, recipient, period, coalesce(invoice_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where period is not null and status in ('pending', 'sent', 'skipped');

-- Claims one log row per (invoice, period) pair; returns only the rows this
-- call won. Pass one null invoice for emails that are not about an invoice.
create function public.claim_notifications(
  p_type text,
  p_recipient text,
  p_invoices uuid[],
  p_periods text[]
) returns table (claimed_log_id uuid, claimed_invoice_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(cardinality(p_periods), 0) = 0 or cardinality(p_periods) <> coalesce(cardinality(p_invoices), 0) then
    raise exception 'Give one period per invoice' using errcode = 'P0001';
  end if;

  update public.notification_logs
  set status = 'failed', error = 'Abandoned: the run that claimed it did not finish'
  where status = 'pending' and sent_at < now() - interval '10 minutes';

  return query
  insert into public.notification_logs as l (type, recipient, invoice_id, period, status)
  select p_type, p_recipient, c.inv, c.period, 'pending'
  from unnest(p_invoices, p_periods) as c (inv, period)
  on conflict (type, recipient, period, (coalesce(invoice_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    where period is not null and status in ('pending', 'sent', 'skipped')
    do nothing
  returning l.id, l.invoice_id;
end;
$$;

-- Records how claimed rows ended: sent (with the provider's id), failed (frees
-- the claim), or skipped (nothing to say this period).
create function public.finish_notifications(
  p_log_ids uuid[],
  p_status text,
  p_subject text,
  p_provider_message_id text,
  p_error text
) returns void
language sql security definer set search_path = '' as $$
  update public.notification_logs
  set status = p_status, subject = p_subject, provider_message_id = p_provider_message_id,
      error = p_error, sent_at = now()
  where id = any (p_log_ids) and status = 'pending';
$$;

-- Only the scheduled jobs (secret key) may claim and finish.
revoke execute on function public.claim_notifications(text, text, uuid[], text[]) from public, anon, authenticated;
revoke execute on function public.finish_notifications(uuid[], text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_notifications(text, text, uuid[], text[]) to service_role;
grant execute on function public.finish_notifications(uuid[], text, text, text, text) to service_role;

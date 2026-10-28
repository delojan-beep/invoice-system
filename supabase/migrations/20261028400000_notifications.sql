-- Automation (milestone M5).
-- Every email the app sends is logged. Scheduled jobs read the log to know
-- whether something was already sent ("due, and not sent yet"), so a missed
-- run catches up and nothing goes out twice.

alter table public.notification_logs
  add column subject text,
  add constraint notification_logs_status check (status in ('sent', 'failed', 'skipped'));

create index notification_logs_lookup on public.notification_logs (type, recipient, sent_at desc);
create index notification_logs_invoice_type on public.notification_logs (invoice_id, type, sent_at desc);

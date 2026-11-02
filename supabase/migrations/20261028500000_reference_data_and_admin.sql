-- Admin and launch (milestone M6).
--
-- 1. Reference data and PRD defaults move here from seed.sql: Supabase runs
--    seed.sql only on local resets, never on deploy, so production would have
--    started with no currencies, line types or settings. Every insert skips
--    rows that already exist, so this is safe on any database.
-- 2. Email wording an admin can add to each email.
-- 3. Which invoices have been copied to the Google Sheet backup.

insert into public.currencies (code, name, symbol, decimal_places) values
  ('CAD', 'Canadian dollar', '$', 2),
  ('LKR', 'Sri Lankan rupee', 'Rs', 2)
on conflict (code) do nothing;

-- Placeholder rates, switched off until the accountant confirms which apply.
insert into public.tax_rates (name, percentage, label, currency_code, active)
select v.name, v.percentage, v.label, v.currency_code, false
from (values
  ('VAT 18%', 18.000, 'VAT', 'LKR'),
  ('GST 5%', 5.000, 'GST/HST', 'CAD'),
  ('HST 13%', 13.000, 'GST/HST', 'CAD')
) as v (name, percentage, label, currency_code)
where not exists (select 1 from public.tax_rates t where t.name = v.name and t.currency_code = v.currency_code);

insert into public.line_types (name, receipt_required, sort_order) values
  ('Professional fees', false, 1),
  ('Expense', true, 2),
  ('App fee', true, 3),
  ('Other', false, 4)
on conflict (name) do nothing;

insert into public.settings (key, value) values
  ('review_period_days', '10'),
  ('daily_summary_time', '"08:00"'),             -- in the CEO's timezone
  ('monthly_summary', '{"day": 15, "time": "18:30", "timezone": "Asia/Colombo"}'),
  ('summary_recipients', '["approver", "accounts"]'),
  ('reminder_fields', '["number", "date", "total"]'),
  ('invoice_number_format', '"QN-{EMP}-{YYYY}-{MM}-{NNN}"'),
  ('base_currency', '"CAD"'),
  ('wise_fee_payer', 'null'),                    -- open item: choose before launch
  ('company', '{"name": "QNetwork", "business_number": "", "address": ""}'),
  -- Optional note an admin adds to the top of each kind of email.
  ('email_wording', '{"status_update": "", "daily_summary": "", "deadline_warning": "", "overdue_alert": "", "monthly_summary": ""}')
on conflict (key) do nothing;

-- Google Sheet backup: approved and paid invoices are copied once.
alter table public.invoices add column sheet_exported_at timestamptz;

-- Reference data and PRD default settings. Users are created by scripts/seed-users.ts,
-- because Supabase Auth users must be made through the Auth API.

insert into public.currencies (code, name, symbol, decimal_places) values
  ('CAD', 'Canadian dollar', '$', 2),
  ('LKR', 'Sri Lankan rupee', 'Rs', 2);

-- Placeholder rates, switched off until the accountant confirms which apply.
insert into public.tax_rates (name, percentage, label, currency_code, active) values
  ('VAT 18%', 18.000, 'VAT', 'LKR', false),
  ('GST 5%', 5.000, 'GST/HST', 'CAD', false),
  ('HST 13%', 13.000, 'GST/HST', 'CAD', false);

insert into public.line_types (name, receipt_required, sort_order) values
  ('Professional fees', false, 1),
  ('Expense', true, 2),
  ('App fee', true, 3),
  ('Other', false, 4);

insert into public.settings (key, value) values
  ('review_period_days', '10'),
  ('daily_summary_time', '"08:00"'),             -- in the CEO's timezone
  ('monthly_summary', '{"day": 15, "time": "18:30", "timezone": "Asia/Colombo"}'),
  ('summary_recipients', '["approver", "accounts"]'),
  ('reminder_fields', '["number", "date", "total"]'),
  ('invoice_number_format', '"QN-{EMP}-{YYYY}-{MM}-{NNN}"'),
  ('base_currency', '"CAD"'),
  ('wise_fee_payer', 'null'),                    -- open item: choose before launch
  ('company', '{"business_number": "", "address": ""}');

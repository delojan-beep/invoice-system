-- Local development only (runs after migrations on `supabase db reset`).
-- Reference data and default settings live in the migrations
-- (20261028500000_reference_data_and_admin.sql) so production gets them too.
-- Dev users are created by scripts/seed-users.ts through the Auth API.
select 1;

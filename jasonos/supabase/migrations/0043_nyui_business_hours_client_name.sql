-- 0043_nyui_business_hours_client_name.sql
-- ---------------------------------------------------------------------------
-- Add a client_name column so NYUI business-hours logs can record which
-- client the time was for. Nullable so existing rows keep working; the UI
-- requires a client for new entries and suggests previously used names.
-- ---------------------------------------------------------------------------

alter table public.business_hours
  add column if not exists client_name text;

create index if not exists business_hours_client_name_idx
  on public.business_hours(client_name);

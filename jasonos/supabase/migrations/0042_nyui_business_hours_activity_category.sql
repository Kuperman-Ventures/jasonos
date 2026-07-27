-- 0042_nyui_business_hours_activity_category.sql
-- ---------------------------------------------------------------------------
-- Add an activity_category column so NYUI business-hours logs can break time
-- down across work types (Materials, Emails, Meetings, etc.). Nullable so
-- existing rows keep working; the UI requires a category for new entries.
-- ---------------------------------------------------------------------------

alter table public.business_hours
  add column if not exists activity_category text;

create index if not exists business_hours_activity_category_idx
  on public.business_hours(activity_category);

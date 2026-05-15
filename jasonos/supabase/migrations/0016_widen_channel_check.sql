-- 0016_widen_channel_check.sql
-- Phase 5A follow-up. Migration 0014 created `contact_touches_channel_check`
-- with only the original 6 channels. Phase 5A expanded the TypeScript
-- `TouchChannel` to 10 values (added coffee_chat, text, thank_you_note,
-- value_sharing) but never widened the DB CHECK, so manual log-touch inserts
-- using the new channels fail with:
--   new row for relation "contact_touches" violates check constraint
--   "contact_touches_channel_check"
--
-- This migration drops the old constraint and recreates it with the full
-- 10-value set. Idempotent — safe to re-run.

set search_path = jasonos, public;

-- Drop existing channel CHECK if present (named in 0014)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'contact_touches_channel_check'
      and conrelid = 'jasonos.contact_touches'::regclass
  ) then
    alter table jasonos.contact_touches
      drop constraint contact_touches_channel_check;
  end if;
end $$;

-- Recreate with the Phase 5A channel set.
alter table jasonos.contact_touches
  add constraint contact_touches_channel_check
  check (channel in (
    'email',
    'calendar',
    'linkedin',
    'phone',
    'in_person',
    'coffee_chat',
    'text',
    'thank_you_note',
    'value_sharing',
    'other'
  ));

-- Link Google Calendar events to jasonos.meetings so calendar sync can load
-- matched contact meetings into the contact Meetings tab.
-- Idempotent. Apply via Supabase Dashboard → SQL Editor or MCP apply_migration.

alter table jasonos.meetings
  add column if not exists gcal_event_id text,
  add column if not exists calendar_url text,
  add column if not exists title text;

-- One synced calendar event per contact (multi-attendee events create one row
-- per matched JasonOS contact).
create unique index if not exists uniq_meetings_contact_gcal_event
  on jasonos.meetings (contact_id, gcal_event_id)
  where gcal_event_id is not null;

create index if not exists idx_meetings_gcal_event_id
  on jasonos.meetings (gcal_event_id)
  where gcal_event_id is not null;

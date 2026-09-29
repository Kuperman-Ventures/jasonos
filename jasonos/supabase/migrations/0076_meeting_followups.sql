-- Calendar meeting follow-ups. Sync finds past personal-calendar meetings
-- where Jason has not emailed one or more attendees since the meeting ended.
-- Home / Follow Up shows open rows. Drafts open in Apple Mail (no auto-send).
-- Service-role only.

set search_path = jasonos, public;

create table if not exists jasonos.meeting_followups (
  id uuid primary key default gen_random_uuid(),
  gcal_event_id text not null unique,
  ical_uid text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  calendar_url text,
  attendees jsonb not null default '[]'::jsonb,
  pending_attendees jsonb not null default '[]'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'done', 'dismissed', 'snoozed')),
  snooze_until date,
  granola_summary text,
  granola_url text,
  draft_subject text,
  draft_body text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_followups_status_ends_idx
  on jasonos.meeting_followups (status, ends_at desc);

create index if not exists meeting_followups_snooze_idx
  on jasonos.meeting_followups (status, snooze_until);

alter table jasonos.meeting_followups enable row level security;

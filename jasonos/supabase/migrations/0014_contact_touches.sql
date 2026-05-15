-- 0014_contact_touches.sql
-- Phase 4 of the Outreach consolidation. Adds the canonical
-- `jasonos.contact_touches` table — every captured touch (email sent, meeting
-- attended, manual log, etc.) lands here keyed on `jasonos.contacts.id`,
-- regardless of whether the contact maps to a recruiter pipeline row.
--
-- Idempotent. Apply via Supabase Dashboard → SQL Editor.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists jasonos.contact_touches (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references jasonos.contacts(id) on delete cascade,
  channel       text not null,        -- 'email' | 'calendar' | 'linkedin' | 'phone' | 'in_person' | 'other'
  direction     text not null,        -- 'outbound' | 'inbound'
  touched_at    timestamptz not null,
  source        text,                 -- 'gmail' | 'gcal' | 'hubspot' | 'manual' | 'rr_legacy'
  external_id   text,                 -- gmail message id / gcal event id / hubspot engagement id / rr_touches.id
  brief         text,
  subject       text,
  thread_url    text,
  inserted_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

do $$ begin
  alter table jasonos.contact_touches
    add constraint contact_touches_channel_check
    check (channel in ('email','calendar','linkedin','phone','in_person','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table jasonos.contact_touches
    add constraint contact_touches_direction_check
    check (direction in ('outbound','inbound'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_contact_touches_contact_id
  on jasonos.contact_touches (contact_id, touched_at desc);

create index if not exists idx_contact_touches_touched_at
  on jasonos.contact_touches (touched_at desc);

create unique index if not exists uniq_contact_touches_source_external_id
  on jasonos.contact_touches (source, external_id)
  where source is not null and external_id is not null;

-- ---------------------------------------------------------------------------
-- Backfill from rr_touches
-- ---------------------------------------------------------------------------
-- rr_touches.contact_id actually references rr_recruiters.id (legacy schema
-- name). We map rr_recruiters.id → jasonos.contacts.id via
-- jasonos.contacts.source_ids->>'recruiter_pipeline_id', then insert.
--
-- Dedup strategy:
--   - If rr_touches has a non-null (source, external_id) tuple (gmail/hubspot
--     syncs added these in migration 0011), preserve them so re-running
--     gmail/calendar syncs won't double-insert.
--   - Otherwise stamp source='rr_legacy', external_id=rr_touches.id so we
--     have *some* unique key per row.
-- The ON CONFLICT clause uses the partial unique index so re-running this
-- migration is safe.

insert into jasonos.contact_touches
  (contact_id, channel, direction, touched_at, source, external_id,
   brief, subject, thread_url, inserted_at)
select
  c.id,
  coalesce(rt.channel, 'other'),
  coalesce(rt.direction, 'outbound'),
  coalesce(rt.touched_at, now()),
  coalesce(rt.source, 'rr_legacy'),
  coalesce(rt.external_id, rt.id::text),
  rt.brief,
  rt.subject,
  rt.thread_url,
  coalesce(rt.touched_at, now())
from public.rr_touches rt
join jasonos.contacts c
  on (c.source_ids->>'recruiter_pipeline_id')::uuid = rt.contact_id
on conflict (source, external_id) do nothing;

-- ---------------------------------------------------------------------------
-- Sync state — persist last-sync timestamps so the UI can show "last synced
-- 3 minutes ago" and skip emails we've already seen.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.outreach_sync_state (
  source        text primary key,         -- 'gmail' | 'gcal' | 'hubspot'
  last_synced_at timestamptz,
  last_result   jsonb,                    -- { written, matched, skipped, error? }
  updated_at    timestamptz not null default now()
);

-- Seed rows so the settings UI can render a stable list even before the first
-- sync runs.
insert into jasonos.outreach_sync_state (source) values ('gmail') on conflict do nothing;
insert into jasonos.outreach_sync_state (source) values ('gcal')  on conflict do nothing;
insert into jasonos.outreach_sync_state (source) values ('hubspot') on conflict do nothing;

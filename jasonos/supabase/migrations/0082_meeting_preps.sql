-- Meeting prep: one row per calendar event. Holds the meeting purpose,
-- the gathered source items and the generated brief.
-- Service-role only.

set search_path = jasonos, public;

create table if not exists jasonos.meeting_preps (
  id uuid primary key default gen_random_uuid(),
  gcal_event_id text not null unique,
  ical_uid text,
  calendar_source text not null default 'google',   -- google | outlook
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  calendar_url text,
  conference_url text,
  location text,
  description text,
  attendees jsonb not null default '[]'::jsonb,     -- [{ email, name, contact_id }]
  purpose text,
  purpose_source text,                              -- calendar | suggested | user
  purpose_confirmed boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'gathering', 'gathered', 'building', 'ready', 'error')),
  error text,
  brief jsonb,
  gathered_at timestamptz,
  built_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_preps_starts_idx
  on jasonos.meeting_preps (starts_at);

create table if not exists jasonos.meeting_prep_sources (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references jasonos.meeting_preps(id) on delete cascade,
  source_type text not null,
    -- gmail | outlook | granola | jasonos_touch | jasonos_meeting
    -- | jasonos_research | job_search | calendar | document_link
  external_id text not null,
  account_email text,
  title text,
  url text,
  occurred_at timestamptz,
  people jsonb not null default '[]'::jsonb,
  snippet text,
  relevance smallint,                               -- 0..3, set in Part B
  relevance_reason text,
  pinned boolean not null default false,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (prep_id, source_type, external_id)
);

create index if not exists meeting_prep_sources_prep_idx
  on jasonos.meeting_prep_sources (prep_id);

alter table jasonos.meeting_preps enable row level security;
alter table jasonos.meeting_prep_sources enable row level security;

-- Webinar sessions, takeaways, and weekly digests.
-- Filled by a scheduled Claude run via MCP / HTTP; JasonOS detects candidates
-- and shows /webinars. Service-role only, same isolation as professor_roadmap.

set search_path = jasonos, public;

create table if not exists jasonos.webinar_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  session_date date not null,
  started_at timestamptz,
  duration_minutes int,
  title text not null,
  host_org text not null default '',
  speakers jsonb not null default '[]'::jsonb,
  gcal_event_id text,
  calendar_url text,
  transcript_source text check (transcript_source in ('granola', 'wispr')),
  transcript_note_id text,
  transcript_url text,
  detection text not null check (detection in (
    'calendar_and_note',
    'calendar_only',
    'note_folder',
    'note_solo_long'
  )),
  status text not null default 'candidate' check (status in (
    'candidate',
    'confirmed',
    'dismissed'
  )),
  summary_md text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webinar_sessions_session_date_idx
  on jasonos.webinar_sessions (session_date desc);

comment on table jasonos.webinar_sessions is
  'Detected webinar candidates and published session summaries for /webinars.';

create table if not exists jasonos.webinar_takeaways (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references jasonos.webinar_sessions(id) on delete cascade,
  sort_order int not null default 0,
  text text not null,
  track text check (track in ('venture', 'advisors', 'job_search', 'personal')),
  relevance_note text not null default '',
  is_action boolean not null default false,
  card_id uuid references jasonos.cards(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table jasonos.webinar_takeaways is
  'Published takeaways for a webinar session, optionally linked to an Action Queue card.';

create table if not exists jasonos.webinar_digests (
  week_start date primary key,
  body_md text not null,
  session_ids uuid[] not null default '{}',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table jasonos.webinar_digests is
  'Friday weekly webinar digests keyed by Monday (America/New_York).';

drop trigger if exists set_updated_at on jasonos.webinar_sessions;
create trigger set_updated_at
  before update on jasonos.webinar_sessions
  for each row execute function jasonos.set_updated_at();

drop trigger if exists set_updated_at on jasonos.webinar_digests;
create trigger set_updated_at
  before update on jasonos.webinar_digests
  for each row execute function jasonos.set_updated_at();

alter table jasonos.webinar_sessions enable row level security;
alter table jasonos.webinar_takeaways enable row level security;
alter table jasonos.webinar_digests enable row level security;

revoke all on table jasonos.webinar_sessions from anon, authenticated;
revoke all on table jasonos.webinar_takeaways from anon, authenticated;
revoke all on table jasonos.webinar_digests from anon, authenticated;

grant all on table jasonos.webinar_sessions to service_role;
grant all on table jasonos.webinar_takeaways to service_role;
grant all on table jasonos.webinar_digests to service_role;

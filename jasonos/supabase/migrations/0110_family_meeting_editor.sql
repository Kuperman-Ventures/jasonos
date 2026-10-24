-- Family Meeting editor: day blocks + occurrence/series edits.
-- Service-role only (same arrangement as project_links / commitment checks).

set search_path = jasonos, public;

-- One row per America/New_York calendar day. Open days are in the rolling
-- two-week editor window; past days flip to logged after 11:59pm ET.
create table if not exists jasonos.family_meeting_day_blocks (
  day_key date primary key,
  status text not null default 'open'
    check (status in ('open', 'logged')),
  logged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_meeting_day_blocks_status_idx
  on jasonos.family_meeting_day_blocks (status, day_key);

comment on table jasonos.family_meeting_day_blocks is
  'Family Meeting day buckets (ET). Visible editor window is always the next 14 open days; past days log after local midnight.';

-- Per-occurrence edits (hide this showing; promote/demote this instance).
create table if not exists jasonos.family_meeting_occurrence_edits (
  occurrence_key text primary key,
  series_key text not null,
  group_id text not null,
  day_key date not null references jasonos.family_meeting_day_blocks (day_key)
    on delete cascade,
  title text not null default '',
  starts_at timestamptz not null,
  hidden boolean not null default false,
  presentation text not null default 'auto'
    check (presentation in ('auto', 'spotlight', 'routine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_meeting_occurrence_edits_day_idx
  on jasonos.family_meeting_occurrence_edits (day_key);

create index if not exists family_meeting_occurrence_edits_series_idx
  on jasonos.family_meeting_occurrence_edits (series_key);

comment on table jasonos.family_meeting_occurrence_edits is
  'Occurrence-level Family Meeting edits. hidden=true removes this instance from the board; a later calendar occurrence with a new starts_at is not hidden. presentation overrides auto rhythm detection.';

-- Series-level archive (all occurrences of this series stay archived).
create table if not exists jasonos.family_meeting_series_edits (
  series_key text primary key,
  title text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table jasonos.family_meeting_series_edits is
  'Series-level Family Meeting edits. archived=true hides every occurrence of the series until unarchived.';

drop trigger if exists family_meeting_day_blocks_set_updated_at
  on jasonos.family_meeting_day_blocks;
create trigger family_meeting_day_blocks_set_updated_at
  before update on jasonos.family_meeting_day_blocks
  for each row execute function jasonos.set_updated_at();

drop trigger if exists family_meeting_occurrence_edits_set_updated_at
  on jasonos.family_meeting_occurrence_edits;
create trigger family_meeting_occurrence_edits_set_updated_at
  before update on jasonos.family_meeting_occurrence_edits
  for each row execute function jasonos.set_updated_at();

drop trigger if exists family_meeting_series_edits_set_updated_at
  on jasonos.family_meeting_series_edits;
create trigger family_meeting_series_edits_set_updated_at
  before update on jasonos.family_meeting_series_edits
  for each row execute function jasonos.set_updated_at();

alter table jasonos.family_meeting_day_blocks enable row level security;
alter table jasonos.family_meeting_occurrence_edits enable row level security;
alter table jasonos.family_meeting_series_edits enable row level security;

revoke all on table jasonos.family_meeting_day_blocks from anon, authenticated;
revoke all on table jasonos.family_meeting_occurrence_edits from anon, authenticated;
revoke all on table jasonos.family_meeting_series_edits from anon, authenticated;

grant all on table jasonos.family_meeting_day_blocks to service_role;
grant all on table jasonos.family_meeting_occurrence_edits to service_role;
grant all on table jasonos.family_meeting_series_edits to service_role;

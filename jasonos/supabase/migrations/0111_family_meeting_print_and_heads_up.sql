-- Family Meeting: Long Term Heads Up + frozen Friday print packs.

set search_path = jasonos, public;

-- Allow presentation = heads_up on occurrence edits.
alter table jasonos.family_meeting_occurrence_edits
  drop constraint if exists family_meeting_occurrence_edits_presentation_check;

alter table jasonos.family_meeting_occurrence_edits
  add constraint family_meeting_occurrence_edits_presentation_check
  check (presentation in ('auto', 'spotlight', 'routine', 'heads_up'));

-- Frozen print pack produced Friday ~11:59pm ET for Sat → next Sunday.
create table if not exists jasonos.family_meeting_print_packs (
  id uuid primary key default gen_random_uuid(),
  -- Friday date (ET) that triggered the freeze.
  freeze_friday date not null unique,
  range_start date not null,
  range_end date not null,
  label text not null default '',
  -- Full printable payload (sheets + events + heads-ups).
  payload jsonb not null default '{}'::jsonb,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_meeting_print_packs_created_idx
  on jasonos.family_meeting_print_packs (created_at desc);

comment on table jasonos.family_meeting_print_packs is
  'Frozen Family Meeting print packs. One per Friday freeze; covers Saturday through the following Sunday.';

drop trigger if exists family_meeting_print_packs_set_updated_at
  on jasonos.family_meeting_print_packs;
create trigger family_meeting_print_packs_set_updated_at
  before update on jasonos.family_meeting_print_packs
  for each row execute function jasonos.set_updated_at();

alter table jasonos.family_meeting_print_packs enable row level security;
revoke all on table jasonos.family_meeting_print_packs from anon, authenticated;
grant all on table jasonos.family_meeting_print_packs to service_role;

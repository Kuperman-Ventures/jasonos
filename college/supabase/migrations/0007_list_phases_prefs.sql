-- List funnel phases, archive metadata, and per-member column prefs.
-- Service role only, same as prior college migrations.

alter table college.schools
  add column if not exists list_phase text not null default 'exploration',
  add column if not exists phases_participated text[] not null default array['exploration']::text[],
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table college.schools drop constraint if exists schools_list_phase_check;
alter table college.schools
  add constraint schools_list_phase_check
  check (list_phase in ('exploration', 'consideration', 'applications'));

update college.schools
set
  list_phase = 'exploration',
  phases_participated = array['exploration']::text[],
  archived = false
where list_phase is null or list_phase = '';

create table if not exists college.member_prefs (
  member_id text primary key references college.members(id) on delete cascade,
  colleges_columns jsonb not null default '{}'::jsonb,
  show_archived boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on table college.member_prefs from public, anon, authenticated;
grant all on table college.member_prefs to service_role;

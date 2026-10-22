-- Live plans (unattached), post-call confirmations, review company facts,
-- company research_verified, and listen_for on points/script items.
-- Safe to re-run. Number is 0103 because 0099–0102 are already taken.

set search_path = jasonos, public;

alter table jasonos.live_scripts
  add column if not exists kind text not null default 'strategy',
  add column if not exists attached_prep_id uuid references jasonos.meeting_preps(id) on delete set null,
  add column if not exists attached_at timestamptz,
  add column if not exists outcome_sentence text,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'live_scripts_kind_check'
      and conrelid = 'jasonos.live_scripts'::regclass
  ) then
    alter table jasonos.live_scripts
      add constraint live_scripts_kind_check
      check (kind in ('strategy', 'plan'));
  end if;
end $$;

create index if not exists live_scripts_kind_idx on jasonos.live_scripts (kind);

comment on column jasonos.live_scripts.kind is
  'strategy = reusable playbook; plan = unattached meeting plan until attached_prep_id is set.';
comment on column jasonos.live_scripts.outcome_sentence is
  'Plans carry the meeting outcome sentence until attached; strategies use success_sentence.';
comment on column jasonos.live_scripts.notes is
  'Free text on a plan: who it is for, what Jason knows.';

alter table jasonos.meeting_points
  add column if not exists confirmed_state text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists listen_for text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'meeting_points_confirmed_state_check'
      and conrelid = 'jasonos.meeting_points'::regclass
  ) then
    alter table jasonos.meeting_points
      add constraint meeting_points_confirmed_state_check
      check (
        confirmed_state is null
        or confirmed_state in ('covered', 'skipped', 'not_reached')
      );
  end if;
end $$;

comment on column jasonos.meeting_points.confirmed_state is
  'Post-call confirmed mark. Live state is a draft; confirmed_state is the record.';
comment on column jasonos.meeting_points.listen_for is
  'What Jason listens for while this section is current on the live screen.';

alter table jasonos.live_script_items
  add column if not exists listen_for text;

comment on column jasonos.live_script_items.listen_for is
  'Copied onto meeting_points.listen_for when the script or plan is applied.';

alter table jasonos.meeting_reviews
  add column if not exists company_facts jsonb not null default '{}'::jsonb;

comment on column jasonos.meeting_reviews.company_facts is
  'Facts stated in the transcript: { attendees: [{ contactId?, name?, title, company, role_line }] }.';
comment on column jasonos.meeting_reviews.points_spoken is
  'Array of { pointId, spoken, match: exact|close|none, nearest, quote?, timestamp? }. match/nearest added for meaning-based review.';

alter table jasonos.companies
  add column if not exists research_verified boolean not null default false;

comment on column jasonos.companies.research_verified is
  'True when research read at least one page from the company domain.';

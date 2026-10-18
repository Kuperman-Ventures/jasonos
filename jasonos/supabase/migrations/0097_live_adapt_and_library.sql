-- Adapt proposals, goal links, and the indexes the Live library filters on.
-- Service-role only, same arrangement as 0095_live_strategy_and_score.sql.
-- Safe to re-run.

set search_path = jasonos, public;

alter table jasonos.meeting_preps
  add column if not exists project_id uuid references jasonos.projects(id) on delete set null,
  add column if not exists primary_contact_id uuid references jasonos.contacts(id) on delete set null,
  add column if not exists adapted_from_script_id uuid references jasonos.live_scripts(id) on delete set null,
  add column if not exists adapted_at timestamptz;

create index if not exists meeting_preps_primary_contact_idx
  on jasonos.meeting_preps (primary_contact_id);

create index if not exists meeting_preps_live_ended_idx
  on jasonos.meeting_preps (live_ended_at)
  where live_ended_at is not null;

comment on column jasonos.meeting_preps.project_id is
  'Optional project this meeting is working toward. Context for the review, not a substitute for the outcome sentence.';

comment on column jasonos.meeting_preps.primary_contact_id is
  'The person this Live meeting is about. Defaults to the first matched attendee.';

comment on column jasonos.meeting_preps.adapted_from_script_id is
  'Set when Jason accepts an adapted plan. script_id is still the strategy that was applied.';

-- Backfill the person from the first attendee who is already a contact.
update jasonos.meeting_preps as prep
set primary_contact_id = picked.contact_id
from (
  select prep_id, contact_id
  from (
    select
      p.id as prep_id,
      (att->>'contact_id')::uuid as contact_id,
      row_number() over (partition by p.id order by ordinality) as rn
    from jasonos.meeting_preps p
    cross join lateral jsonb_array_elements(coalesce(p.attendees, '[]'::jsonb)) with ordinality as t(att, ordinality)
    where p.primary_contact_id is null
      and att->>'contact_id' is not null
      and att->>'contact_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) ranked
  where rn = 1
) as picked
where prep.id = picked.prep_id
  and exists (select 1 from jasonos.contacts c where c.id = picked.contact_id);

create table if not exists jasonos.meeting_adaptations (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references jasonos.meeting_preps(id) on delete cascade,
  script_id uuid not null references jasonos.live_scripts(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  context_used jsonb not null default '[]'::jsonb,
  context_missing jsonb not null default '[]'::jsonb,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_adaptations_prep_script_key unique (prep_id, script_id)
);

alter table jasonos.meeting_adaptations
  drop constraint if exists meeting_adaptations_status_check;
alter table jasonos.meeting_adaptations
  add constraint meeting_adaptations_status_check
  check (status in ('proposed', 'accepted', 'discarded'));

comment on table jasonos.meeting_adaptations is
  'A proposed rewrite of a strategy for one meeting. Nothing is copied onto the meeting until Jason accepts it.';

comment on column jasonos.meeting_adaptations.items is
  '[{ kind, headline, detail, prepare_reactions, reactions, source_hint, dropped, dropped_reason }]. Dropped items stay in the list so Jason can see why.';

alter table jasonos.meeting_adaptations enable row level security;
revoke all on table jasonos.meeting_adaptations from anon, authenticated;

drop trigger if exists meeting_adaptations_set_updated_at on jasonos.meeting_adaptations;
create trigger meeting_adaptations_set_updated_at
  before update on jasonos.meeting_adaptations
  for each row execute function jasonos.set_updated_at();

alter table jasonos.meeting_reviews
  add column if not exists project_goal_note text,
  add column if not exists relationship_goal_note text;

comment on column jasonos.meeting_reviews.project_goal_note is
  'One sentence on what the transcript says about the linked project goal. Null when there is no project or the text does not bear on it.';

comment on column jasonos.meeting_reviews.relationship_goal_note is
  'One sentence on what the transcript says about the contact personal goal.';

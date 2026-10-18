-- Strategy fields, prepared reactions, outcome marks, and one transcript review per meeting.
-- Tables stay live_scripts / live_script_items. The UI calls them strategies.
-- Service-role only, same arrangement as 0093_live_scripts.sql.
-- Safe to re-run.

set search_path = jasonos, public;

alter table jasonos.live_scripts
  add column if not exists situation text,
  add column if not exists success_sentence text,
  add column if not exists rubric jsonb not null default '[]'::jsonb,
  add column if not exists methodology_source text;

comment on column jasonos.live_scripts.situation is
  'When this strategy applies, in one sentence. Jason writes this. The model does not.';

comment on column jasonos.live_scripts.success_sentence is
  'One sentence the meeting can be scored against. Copied onto a meeting outcome when that meeting has none.';

comment on column jasonos.live_scripts.rubric is
  'Checklist lines Jason writes, max 12. The transcript review checks each one. Example: ["Asked why they took the meeting"].';

comment on column jasonos.live_scripts.methodology_source is
  'Free text for where the strategy came from, e.g. "Browning Associates networking method".';

alter table jasonos.live_script_items
  add column if not exists prepare_reactions boolean not null default false,
  add column if not exists reactions jsonb not null default '[]'::jsonb;

comment on column jasonos.live_script_items.reactions is
  'Six prepared reactions: [{shape, soundsLike, pivot}]. Shapes are agree, soft_agree, defer, deflect, counter_ask, decline.';

alter table jasonos.meeting_points
  add column if not exists prepare_reactions boolean not null default false,
  add column if not exists reactions jsonb not null default '[]'::jsonb,
  add column if not exists observed_reaction text,
  add column if not exists source_hint text;

alter table jasonos.meeting_points
  drop constraint if exists meeting_points_observed_reaction_check;
alter table jasonos.meeting_points
  add constraint meeting_points_observed_reaction_check
  check (
    observed_reaction is null
    or observed_reaction in ('agree', 'soft_agree', 'defer', 'deflect', 'counter_ask', 'decline')
  );

comment on column jasonos.meeting_points.source_hint is
  'One line naming the fact or source this point came from. Null when it is Jason''s own purpose.';

comment on column jasonos.meeting_points.observed_reaction is
  'The reaction shape Jason recorded on the live screen. Null until he picks one.';

alter table jasonos.meeting_preps
  add column if not exists outcome_sentence text,
  add column if not exists outcome_mark text,
  add column if not exists outcome_note text,
  add column if not exists outcome_marked_at timestamptz;

alter table jasonos.meeting_preps
  drop constraint if exists meeting_preps_outcome_mark_check;
alter table jasonos.meeting_preps
  add constraint meeting_preps_outcome_mark_check
  check (outcome_mark is null or outcome_mark in ('hit', 'partial', 'missed'));

comment on column jasonos.meeting_preps.outcome_sentence is
  'The sentence this meeting is scored against. Often copied from the strategy success sentence.';

comment on column jasonos.meeting_preps.outcome_mark is
  'Jason''s record: hit, partial, or missed. The model may suggest one; his click is the record.';

create table if not exists jasonos.meeting_reviews (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references jasonos.meeting_preps(id) on delete cascade,
  source text not null default 'granola',
  source_url text,
  source_kind text not null,
  source_text text,
  points_spoken jsonb not null default '[]'::jsonb,
  rubric_results jsonb not null default '[]'::jsonb,
  reactions_observed jsonb not null default '[]'::jsonb,
  suggested_mark text,
  suggested_reason text,
  talk_ratio numeric,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_reviews_prep_key unique (prep_id)
);

alter table jasonos.meeting_reviews
  drop constraint if exists meeting_reviews_source_kind_check;
alter table jasonos.meeting_reviews
  add constraint meeting_reviews_source_kind_check
  check (source_kind in ('transcript', 'summary', 'none'));

alter table jasonos.meeting_reviews
  drop constraint if exists meeting_reviews_suggested_mark_check;
alter table jasonos.meeting_reviews
  add constraint meeting_reviews_suggested_mark_check
  check (suggested_mark is null or suggested_mark in ('hit', 'partial', 'missed'));

comment on table jasonos.meeting_reviews is
  'One transcript or summary review per meeting. A second run replaces the row. source_text is capped in code at 60,000 characters.';

comment on column jasonos.meeting_reviews.points_spoken is
  '[{ point_id, spoken: bool, quote }] for every markable point.';

comment on column jasonos.meeting_reviews.rubric_results is
  '[{ item, met: bool, quote }] for every checklist line.';

comment on column jasonos.meeting_reviews.reactions_observed is
  '[{ point_id, shape, quote }] for every ask.';

comment on column jasonos.meeting_reviews.talk_ratio is
  'Jason''s share of words, 0-1. Null when the source does not support it.';

drop trigger if exists meeting_reviews_set_updated_at on jasonos.meeting_reviews;
create trigger meeting_reviews_set_updated_at
  before update on jasonos.meeting_reviews
  for each row execute function jasonos.set_updated_at();

alter table jasonos.meeting_reviews enable row level security;
revoke all on table jasonos.meeting_reviews from anon, authenticated;

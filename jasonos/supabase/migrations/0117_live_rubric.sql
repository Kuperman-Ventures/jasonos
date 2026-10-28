-- Live rubric: editable lines on decks/playbooks + global default seed.
set search_path = jasonos, public;

alter table jasonos.decks
  add column if not exists rubric jsonb not null default '[]'::jsonb;

comment on column jasonos.decks.rubric is
  'Plain-language rubric lines (string array) copied playbook ↔ deck; scored in review.';

create table if not exists jasonos.live_defaults (
  id boolean primary key default true check (id),
  rubric jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table jasonos.live_defaults is
  'Singleton defaults for Live (one row, id = true). Default rubric for new playbooks and blank decks.';

insert into jasonos.live_defaults (id, rubric, updated_at)
values (
  true,
  '[
    "Set expectations in the first two minutes: the time we had, why I asked for the call, and that I would ask for names at the end.",
    "Built rapport before business with something specific about them, their company, or the person who referred me.",
    "Asked questions for at least 80 percent of the call; they spoke more than I did.",
    "Covered the industry: where it is going and what is changing.",
    "Covered their company: priorities, pressures, how decisions get made.",
    "Asked for contacts with \"who\" questions and got names, never \"if you know anyone\".",
    "Asked about resources: recruiters, groups, events, reading they would recommend.",
    "Turned to me in under 60 seconds and stopped.",
    "Stated what I am looking for in one sentence they could repeat to someone else.",
    "Did not ask for a job and did not pitch for work.",
    "Named one way I can help them.",
    "Closed with a dated next step on both calendars."
  ]'::jsonb,
  now()
)
on conflict (id) do update
set rubric = excluded.rubric,
    updated_at = now();

-- Backfill empty rubrics from the default.
update jasonos.decks d
set rubric = ld.rubric
from jasonos.live_defaults ld
where ld.id = true
  and (
    d.rubric is null
    or d.rubric = '[]'::jsonb
    or jsonb_typeof(d.rubric) <> 'array'
    or jsonb_array_length(d.rubric) = 0
  );

-- Fuck You Batman story workspace.
--
-- Decisions (ending, hidden purpose, tense, and later weekly calls) and story
-- entries (reference, Story Bible, Drift Map, scenes) live here so the
-- project page, the JasonOS MCP, and scheduled Claude runs share one store.
-- Claude publishes options with upsert_fyb_decision (or POST /api/fyb);
-- Jason records the pick on the Decisions page or in chat via
-- record_fyb_decision. Entries are one table keyed by kind + entry_key.
--
-- Service-role only, same arrangement as the other published home modules.
-- No seed data: the repository is public.

set search_path = jasonos, public;

create table if not exists jasonos.fyb_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  week int not null,
  phase int not null,
  question text not null,
  context text,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'decided')),
  chosen_option_key text,
  custom_answer text,
  jason_note text,
  decided_at timestamptz,
  decided_by text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fyb_decisions_custom_answer_chk check (
    chosen_option_key is distinct from 'custom'
    or (custom_answer is not null and length(btrim(custom_answer)) > 0)
  )
);

create index if not exists fyb_decisions_week_sort_idx
  on jasonos.fyb_decisions (week, sort_order);

create index if not exists fyb_decisions_status_idx
  on jasonos.fyb_decisions (status);

comment on table jasonos.fyb_decisions is
  'Story decisions for Fuck You Batman. options is FybOption[] (lib/fuck-you-batman/types.ts).';

create table if not exists jasonos.fyb_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'reference',
    'bible_character',
    'bible_world',
    'bible_rule',
    'bible_timeline',
    'drift_stage',
    'drift_clue',
    'drift_pattern',
    'scene'
  )),
  entry_key text not null,
  title text not null,
  body_md text not null default '',
  data jsonb not null default '{}'::jsonb,
  links text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved')),
  approved_at timestamptz,
  sort_order int not null default 0,
  updated_by text not null default 'jasonos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, entry_key)
);

create index if not exists fyb_entries_kind_sort_idx
  on jasonos.fyb_entries (kind, sort_order);

comment on table jasonos.fyb_entries is
  'Story content for Fuck You Batman (reference, bible, drift, scenes). One row per kind + entry_key.';

drop trigger if exists fyb_decisions_set_updated_at on jasonos.fyb_decisions;
create trigger fyb_decisions_set_updated_at
  before update on jasonos.fyb_decisions
  for each row execute function jasonos.set_updated_at();

drop trigger if exists fyb_entries_set_updated_at on jasonos.fyb_entries;
create trigger fyb_entries_set_updated_at
  before update on jasonos.fyb_entries
  for each row execute function jasonos.set_updated_at();

alter table jasonos.fyb_decisions enable row level security;
alter table jasonos.fyb_entries enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server and
-- JasonOS MCP) reads and writes. Service role bypasses RLS.

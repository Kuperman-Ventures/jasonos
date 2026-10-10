-- Contact Dashboard relationship briefs + editable prompt (Settings).

alter table public.user_preferences
  add column if not exists relationship_brief_prompt text,
  add column if not exists relationship_brief_prompt_version integer not null default 0,
  add column if not exists relationship_brief_sections jsonb,
  add column if not exists relationship_brief_prompt_updated_at timestamptz;

comment on column public.user_preferences.relationship_brief_prompt is
  'Prompt used to write the contact Dashboard relationship brief. Null uses the app default.';
comment on column public.user_preferences.relationship_brief_prompt_version is
  'Increments on each save of relationship_brief_prompt.';
comment on column public.user_preferences.relationship_brief_sections is
  'Which Dashboard sections to ask the model for. Null means all on.';

create table if not exists jasonos.contact_relationship_briefs (
  contact_id uuid primary key references jasonos.contacts(id) on delete cascade,
  generated_at timestamptz not null default now(),
  prompt_version integer not null default 0,
  sources jsonb not null default '[]'::jsonb,
  summary text,
  helped jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  commitments jsonb not null default '[]'::jsonb,
  remember jsonb not null default '[]'::jsonb,
  next_move jsonb,
  stale boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table jasonos.contact_relationship_briefs is
  'One AI relationship brief per contact for the Contact modal Dashboard tab.';

alter table jasonos.contact_relationship_briefs enable row level security;

drop policy if exists "jason owner only" on jasonos.contact_relationship_briefs;
create policy "jason owner only"
  on jasonos.contact_relationship_briefs
  for all
  using (auth.uid() = 'f4591f07-b8bf-4979-b1c2-5aeefac71937'::uuid)
  with check (auth.uid() = 'f4591f07-b8bf-4979-b1c2-5aeefac71937'::uuid);

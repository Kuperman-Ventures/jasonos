-- Live: goal line, post-run review, AI help last-run metadata.
set search_path = jasonos, public;

alter table jasonos.decks
  add column if not exists goal text,
  add column if not exists review jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists ai_last_run jsonb;

comment on column jasonos.decks.goal is
  'One-line goal for the conversation; copied playbook ↔ deck on Save as / create.';
comment on column jasonos.decks.review is
  'Post-run review JSON: slide marks, goal mark, said/committed/next_time lists.';
comment on column jasonos.decks.reviewed_at is
  'When review was last generated (re-run replaces and clears overrides).';
comment on column jasonos.decks.ai_last_run is
  'Last AI help run: { at, instructions, sources: [...] }.';

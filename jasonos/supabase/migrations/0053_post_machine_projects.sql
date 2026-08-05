-- 0053_post_machine_projects.sql
-- ---------------------------------------------------------------------------
-- Saved Post Machine projects. Snapshot the full step state as JSONB so Jason
-- can leave mid-flow (idea / research / voice / hooks / output) and resume.
-- Read/written by JasonOS server actions via the service role.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.post_machine_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled post',
  step text not null default 'idea'
    check (step in ('idea', 'research', 'config', 'hooks', 'output')),
  input_mode text not null default 'idea'
    check (input_mode in ('idea', 'research')),
  -- Denormalized for the project list UI
  idea_preview text not null default '',
  topic text not null default '',
  -- Full resumable snapshot (idea, guidance, findings, config, hooks, drafts)
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_machine_projects_updated_idx
  on jasonos.post_machine_projects (updated_at desc);

alter table jasonos.post_machine_projects enable row level security;

-- No anon/authenticated policies: only the service role (JasonOS server) reads
-- and writes. Service role bypasses RLS.

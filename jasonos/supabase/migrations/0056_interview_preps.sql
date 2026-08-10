-- 0056_interview_preps.sql
-- ---------------------------------------------------------------------------
-- Saved Interview Prep briefs. One active prep per resume customization
-- (the role/JD + tailored resume it was generated from). Service-role only.
-- ---------------------------------------------------------------------------

create table if not exists jasonos.interview_preps (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid not null references jasonos.resume_customizations(id) on delete cascade,
  company text,
  role_title text,
  prep jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_preps_customization_unique unique (customization_id)
);

create index if not exists interview_preps_updated_idx
  on jasonos.interview_preps (updated_at desc);

alter table jasonos.interview_preps enable row level security;

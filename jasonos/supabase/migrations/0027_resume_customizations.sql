-- 0027_resume_customizations.sql
-- ---------------------------------------------------------------------------
-- Tailored resume outputs produced by the Resume Customizer. The generated
-- .docx binary lives in the private 'resumes' bucket at storage_path; `report`
-- holds the analysis (match score, before/after changes, keyword coverage).
-- Service-role access only (RLS on, no policies).
-- ---------------------------------------------------------------------------

create table if not exists jasonos.resume_customizations (
  id uuid primary key default gen_random_uuid(),
  source_resume_id uuid references jasonos.resumes(id) on delete set null,
  company text,
  filename text not null,
  storage_path text not null,
  match_score integer,
  report jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resume_customizations_created_idx
  on jasonos.resume_customizations(created_at desc);

alter table jasonos.resume_customizations enable row level security;

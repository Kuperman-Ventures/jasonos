-- Cover Letter Customizer (part of Custom Communications). A cover letter is
-- generated FROM a resume customization so it reuses the same job + resume
-- context. Stored as structured sections so we can render/print and re-tweak
-- the format without regenerating.
create table if not exists jasonos.cover_letters (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid references jasonos.resume_customizations(id) on delete set null,
  company text,
  role_title text,
  salutation text,
  opening text,
  background text,
  highlights jsonb not null default '[]'::jsonb,
  closing text,
  job_description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cover_letters_customization
  on jasonos.cover_letters (customization_id);

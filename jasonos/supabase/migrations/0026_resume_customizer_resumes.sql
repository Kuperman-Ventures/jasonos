-- 0026_resume_customizer_resumes.sql
-- ---------------------------------------------------------------------------
-- Resume Customizer storage foundation. The resume .docx binaries live in the
-- private Supabase Storage bucket `resumes`; this table holds their metadata.
-- `is_core` marks the master resume the tool tailors from. Service-role access
-- only (RLS enabled, no policies), matching sibling jasonos tables.
--
-- The `resumes` storage bucket is created out-of-band (private):
--   insert into storage.buckets (id, name, public) values ('resumes','resumes', false);
-- ---------------------------------------------------------------------------

create table if not exists jasonos.resumes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  storage_path text not null,
  is_core boolean not null default false,
  original_filename text,
  content_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_is_core_idx on jasonos.resumes(is_core);

alter table jasonos.resumes enable row level security;

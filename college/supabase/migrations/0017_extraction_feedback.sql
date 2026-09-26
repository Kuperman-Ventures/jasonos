-- Feedback on model-extracted ingest to-dos (approved vs rejected).

create table if not exists college.extraction_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_id text not null,
  title text not null,
  category text,
  confidence real,
  approved boolean not null,
  actor_id text,
  actor_name text
);

create index if not exists extraction_feedback_source_id_idx
  on college.extraction_feedback (source_id);

create index if not exists extraction_feedback_created_at_idx
  on college.extraction_feedback (created_at desc);

revoke all on table college.extraction_feedback from public, anon, authenticated;
grant all on table college.extraction_feedback to service_role;

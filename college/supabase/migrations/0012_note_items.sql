-- Structured Notes pinboard items (created by Ingest, listed on Notes).

alter table college.app_state
  add column if not exists note_items jsonb not null default '[]'::jsonb;

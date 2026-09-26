-- Dynamic checklist steps from Ingest, plus ingest source log.
-- Shared household state on app_state (same pattern as checklist).

alter table college.app_state
  add column if not exists project_steps jsonb not null default '[]'::jsonb,
  add column if not exists ingest_sources jsonb not null default '[]'::jsonb;

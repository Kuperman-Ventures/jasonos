-- Household edits to to-do wording, description, and dates.
alter table college.app_state
  add column if not exists todo_edits jsonb not null default '{}'::jsonb;

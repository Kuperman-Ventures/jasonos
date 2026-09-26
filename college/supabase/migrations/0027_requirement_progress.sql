-- Per-user requirement checklist progress for school detail Requirements tab.
alter table college.app_state
  add column if not exists requirement_progress jsonb not null default '{}'::jsonb;

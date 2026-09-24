-- Nested to-do subtasks, keyed by parent to-do id.
alter table college.app_state
  add column if not exists todo_subtasks jsonb not null default '{}'::jsonb;

-- Household to-do projects (group-by Project in the To-dos view).
alter table college.app_state
  add column if not exists todo_projects jsonb not null default '[]'::jsonb;

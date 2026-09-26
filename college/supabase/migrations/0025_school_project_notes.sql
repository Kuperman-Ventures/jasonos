-- School Project Management notes log (sent to To-Do / Notes / Calendar).

alter table college.schools
  add column if not exists project_notes jsonb not null default '[]'::jsonb;

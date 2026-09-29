-- Per-school additional engineering programs (beyond the three core snapshot programs).

alter table college.schools
  add column if not exists additional_programs jsonb not null default '[]'::jsonb;

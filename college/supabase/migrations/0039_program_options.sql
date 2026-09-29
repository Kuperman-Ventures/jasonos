-- Per-school engineering program checklist options (catalog research or Scorecard).

alter table college.schools
  add column if not exists program_options jsonb not null default '[]'::jsonb,
  add column if not exists program_options_checked_date text not null default '';

-- Tracked programs on the school snapshot (family-owned list of program labels).
alter table college.schools
  add column if not exists tracked_programs jsonb not null default '[]'::jsonb;

-- Family fill when the record's test_policy is blank (never overwrites a filled record).
alter table college.schools
  add column if not exists family_test_policy text not null default '';

-- Allow Restrictive Early Action on admission_track.
alter table college.schools drop constraint if exists schools_admission_track_check;
alter table college.schools
  add constraint schools_admission_track_check
  check (admission_track in ('', 'ed1', 'ed2', 'ea', 'rea', 'rd', 'rolling'));

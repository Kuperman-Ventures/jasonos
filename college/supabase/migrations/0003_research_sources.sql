-- Stores the public pages used when a new school is looked up.
-- Existing schools stay blank. Service role only, same as 0001.

alter table college.schools
  add column if not exists research_sources text not null default '';

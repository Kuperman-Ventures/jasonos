-- Undergrad enrollment for the school snapshot size gauge (College Scorecard latest.student.size).
alter table college.schools
  add column if not exists undergrad_enrollment integer;

comment on column college.schools.undergrad_enrollment is
  'Undergraduate enrollment from College Scorecard; drives Campus size gauge.';

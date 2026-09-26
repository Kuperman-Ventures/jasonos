-- Visit status for the college list Visit column (Visited / Want to Visit / Visit Planned).
alter table college.schools
  add column if not exists visit_status text not null default '';

alter table college.schools drop constraint if exists schools_visit_status_check;
alter table college.schools
  add constraint schools_visit_status_check
  check (visit_status in ('', 'visited', 'want', 'planned'));

-- Carry over the old visited checkbox.
update college.schools
set visit_status = 'visited'
where visited is true and visit_status = '';

comment on column college.schools.visit_status is
  'Family visit intent: visited, want (Want to Visit), planned (Visit Planned), or blank.';

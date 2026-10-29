-- Plan Visit is a separate flag from Visit status (Visited / Want to Visit).
-- Schools marked Plan Visit appear on the Visit Planning page.

alter table college.schools
  add column if not exists plan_visit boolean not null default false;

-- Carry over prior Visit status "planned" into the flag, then clear status.
update college.schools
set plan_visit = true,
    visit_status = ''
where visit_status = 'planned';

alter table college.schools drop constraint if exists schools_visit_status_check;
alter table college.schools
  add constraint schools_visit_status_check
  check (visit_status in ('', 'visited', 'want'));

comment on column college.schools.plan_visit is
  'When true, school is on the Visit Planning list. Independent of visit_status.';

comment on column college.schools.visit_status is
  'Family visit status: visited, want (Want to Visit), or blank.';

-- Pipeline fields for the college list.
-- Selectivity uses the four tiers locked with Jason:
-- extremely selective, very selective, competitive, less competitive.
-- Interest uses top choice, high interest, moderate interest, safety/backup.
-- Schools whose admissions-context line does not fit a tier stay blank.
-- Academic and money fields stay empty. Do not invent stats or prices.
-- Service role only, same as 0001. No anon or authenticated policies.

alter table college.schools
  add column if not exists selectivity_tier text not null default '',
  add column if not exists interest_level text not null default '',
  add column if not exists application_status text not null default '',
  add column if not exists admission_track text not null default '',
  add column if not exists test_policy text not null default '',
  add column if not exists middle_50 text not null default '',
  add column if not exists application_platform text not null default '',
  add column if not exists required_essays text not null default '',
  add column if not exists teacher_recs text not null default '',
  add column if not exists cost_of_attendance text not null default '',
  add column if not exists net_price_estimate text not null default '',
  add column if not exists merit_aid_notes text not null default '';

alter table college.schools drop constraint if exists schools_selectivity_tier_check;
alter table college.schools
  add constraint schools_selectivity_tier_check
  check (selectivity_tier in ('', 'extremely_selective', 'very_selective', 'competitive', 'less_competitive'));

alter table college.schools drop constraint if exists schools_interest_level_check;
alter table college.schools
  add constraint schools_interest_level_check
  check (interest_level in ('', 'top', 'high', 'moderate', 'safety'));

alter table college.schools drop constraint if exists schools_application_status_check;
alter table college.schools
  add constraint schools_application_status_check
  check (application_status in ('', 'researching', 'applying', 'submitted', 'accepted', 'enrolled'));

alter table college.schools drop constraint if exists schools_admission_track_check;
alter table college.schools
  add constraint schools_admission_track_check
  check (admission_track in ('', 'ed1', 'ed2', 'ea', 'rd', 'rolling'));

create table if not exists college.deadlines (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references college.schools(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists college.contacts (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references college.schools(id) on delete cascade,
  name text not null default '',
  role text not null default '',
  email text not null default '',
  phone text not null default ''
);

create index if not exists deadlines_school_id_idx on college.deadlines (school_id, sort_order, due_date);
create index if not exists contacts_school_id_idx on college.contacts (school_id);

update college.schools
set selectivity_tier = 'extremely_selective'
where admissions_context in ('Extremely selective', 'Engineering extremely selective');

update college.schools
set selectivity_tier = 'very_selective'
where admissions_context in (
  'Very selective, especially out-of-state',
  'Very selective for out-of-state engineering',
  'Very selective out-of-state'
);

update college.schools
set selectivity_tier = 'competitive'
where admissions_context in (
  'Competitive',
  'Competitive engineering',
  'Competitive direct-to-engineering pathway'
);

update college.schools
set interest_level = 'top'
where choice = 'top' and interest_level = '';

update college.schools
set admission_track = case plan
  when 'ed' then 'ed1'
  when 'ea' then 'ea'
  when 'rd' then 'rd'
  when 'rolling' then 'rolling'
  else admission_track
end
where plan in ('ed', 'ea', 'rd', 'rolling') and admission_track = '';

insert into college.deadlines (school_id, title, due_date, completed, sort_order)
select
  s.id,
  case when s.deadline_label <> '' then s.deadline_label else 'Application deadline' end,
  s.deadline,
  false,
  0
from college.schools s
where s.deadline is not null
  and not exists (
    select 1 from college.deadlines d
    where d.school_id = s.id and d.due_date is not distinct from s.deadline
  );

alter table college.deadlines enable row level security;
alter table college.contacts enable row level security;

revoke all on college.deadlines from public, anon, authenticated;
revoke all on college.contacts from public, anon, authenticated;
grant all on college.deadlines to service_role;
grant all on college.contacts to service_role;

-- Professor Roadmap: schools, questions, decisions, next steps.
-- Research and planning tool at /projects/professor-roadmap.
-- Same isolation as Dark Matter Travel Tracker: service-role only;
-- anon and authenticated roles have no Data API access.

set search_path = jasonos, public;

create table if not exists jasonos.professor_schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  business_school text not null default '',
  department text not null default '',
  website text not null default '',
  faculty_url text not null default '',
  jobs_url text not null default '',
  is_primary boolean not null default false,
  brief_md text not null default '',
  brief_sources jsonb not null default '[]'::jsonb,
  brief_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jasonos.professor_school_people (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references jasonos.professor_schools(id) on delete cascade,
  name text not null,
  title text not null default '',
  role_kind text not null default 'faculty'
    check (role_kind in ('chair', 'faculty', 'practitioner', 'admin', 'other')),
  profile_url text not null default '',
  contact_id uuid references jasonos.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists jasonos.professor_school_postings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references jasonos.professor_schools(id) on delete cascade,
  title text not null,
  url text not null,
  department text not null default '',
  degree_required text not null default '',
  seen_at timestamptz not null default now(),
  unique (school_id, url)
);

create table if not exists jasonos.professor_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references jasonos.professor_schools(id) on delete cascade,
  sort_order int not null default 0,
  question text not null,
  why_it_matters text not null default '',
  status text not null default 'open'
    check (status in ('open', 'researched', 'confirmed')),
  finding_md text not null default '',
  finding_sources jsonb not null default '[]'::jsonb,
  researched_at timestamptz,
  confirmed_by text not null default '',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jasonos.professor_decisions (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  title text not null,
  why_it_matters text not null default '',
  options jsonb not null default '[]'::jsonb,
  depends_on_question_ids uuid[] not null default '{}',
  proposed_option text not null default '',
  proposed_rationale_md text not null default '',
  proposed_at timestamptz,
  decided_option text not null default '',
  decided_note text not null default '',
  decided_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'proposed', 'decided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jasonos.professor_next_steps (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references jasonos.professor_schools(id) on delete set null,
  question_id uuid references jasonos.professor_questions(id) on delete set null,
  decision_id uuid references jasonos.professor_decisions(id) on delete set null,
  sort_order int not null default 0,
  text text not null,
  rationale text not null default '',
  status text not null default 'open'
    check (status in ('open', 'done', 'skipped')),
  todo_id uuid references jasonos.todos(id) on delete set null,
  generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists professor_school_people_school_idx
  on jasonos.professor_school_people (school_id, name);

create index if not exists professor_school_postings_school_idx
  on jasonos.professor_school_postings (school_id, seen_at desc);

create index if not exists professor_questions_school_sort_idx
  on jasonos.professor_questions (school_id, sort_order, created_at);

create index if not exists professor_decisions_sort_idx
  on jasonos.professor_decisions (sort_order, created_at);

create index if not exists professor_next_steps_status_idx
  on jasonos.professor_next_steps (status, sort_order, created_at);

comment on table jasonos.professor_schools is
  'Professor Roadmap target schools. Service-role only.';
comment on table jasonos.professor_questions is
  'Open research questions for the professor path.';
comment on table jasonos.professor_decisions is
  'Branching decisions that depend on researched questions.';
comment on table jasonos.professor_next_steps is
  'Generated and hand-added next steps for the professor path.';

drop trigger if exists set_updated_at on jasonos.professor_schools;
create trigger set_updated_at
  before update on jasonos.professor_schools
  for each row execute function jasonos.set_updated_at();

drop trigger if exists set_updated_at on jasonos.professor_questions;
create trigger set_updated_at
  before update on jasonos.professor_questions
  for each row execute function jasonos.set_updated_at();

drop trigger if exists set_updated_at on jasonos.professor_decisions;
create trigger set_updated_at
  before update on jasonos.professor_decisions
  for each row execute function jasonos.set_updated_at();

drop trigger if exists set_updated_at on jasonos.professor_next_steps;
create trigger set_updated_at
  before update on jasonos.professor_next_steps
  for each row execute function jasonos.set_updated_at();

alter table jasonos.professor_schools enable row level security;
alter table jasonos.professor_school_people enable row level security;
alter table jasonos.professor_school_postings enable row level security;
alter table jasonos.professor_questions enable row level security;
alter table jasonos.professor_decisions enable row level security;
alter table jasonos.professor_next_steps enable row level security;

revoke all on table jasonos.professor_schools from anon, authenticated;
revoke all on table jasonos.professor_school_people from anon, authenticated;
revoke all on table jasonos.professor_school_postings from anon, authenticated;
revoke all on table jasonos.professor_questions from anon, authenticated;
revoke all on table jasonos.professor_decisions from anon, authenticated;
revoke all on table jasonos.professor_next_steps from anon, authenticated;

grant all on table jasonos.professor_schools to service_role;
grant all on table jasonos.professor_school_people to service_role;
grant all on table jasonos.professor_school_postings to service_role;
grant all on table jasonos.professor_questions to service_role;
grant all on table jasonos.professor_decisions to service_role;
grant all on table jasonos.professor_next_steps to service_role;

-- Seed: Seton Hall primary school, questions, decisions, people, posting.
insert into jasonos.professor_schools (
  slug, name, business_school, department, website, faculty_url, jobs_url, is_primary
)
values (
  'seton-hall',
  'Seton Hall University',
  'Stillman School of Business',
  'Department of Marketing',
  'https://www.shu.edu',
  'https://www.shu.edu/marketing/faculty.html',
  'https://jobs.shu.edu',
  true
)
on conflict (slug) do update set
  name = excluded.name,
  business_school = excluded.business_school,
  department = excluded.department,
  website = excluded.website,
  faculty_url = excluded.faculty_url,
  jobs_url = excluded.jobs_url,
  is_primary = excluded.is_primary;

insert into jasonos.professor_questions (
  school_id, sort_order, question, why_it_matters
)
select s.id, q.sort_order, q.question, q.why_it_matters
from jasonos.professor_schools s
cross join (
  values
    (
      1,
      'Does Stillman treat a non-business master''s degree (Jason holds a Master of Architecture) plus 25 years of senior marketing experience as meeting the adjunct credential floor for marketing courses?',
      'This is the single question that decides whether a new degree is required before applying. AACSB Instructional Practitioner status typically expects a master''s in a discipline related to the teaching field plus significant professional experience; whether a non-business master''s counts is a school-level call.'
    ),
    (
      2,
      'Which undergraduate and MBA marketing courses at Stillman are taught by adjuncts, instructors, or lecturers rather than tenure-line faculty?',
      'Adjunct demand concentrates in specific courses. Knowing which ones tells Jason what to propose and what proof to prepare.'
    ),
    (
      3,
      'When does the Department of Marketing staff adjuncts for spring and fall terms, and who makes that call?',
      'Outreach timed after a term is staffed goes nowhere. The chair or program coordinator usually owns this.'
    ),
    (
      4,
      'What does Seton Hall pay adjuncts per course, and is there a union or published scale?',
      'Sets expectations and tells Jason whether this is an income line or a credential line.'
    ),
    (
      5,
      'Does Stillman use guest lecturers or executive-in-residence roles, and have any of them moved into adjunct teaching?',
      'A guest lecture is the lowest-cost way to create an internal champion and classroom proof.'
    ),
    (
      6,
      'Which Stillman marketing faculty teach digital, analytics, B2B, or go-to-market content that overlaps Jason''s experience?',
      'These are the likely champions and the people whose courses Jason could support or guest in.'
    ),
    (
      7,
      'Do current adjunct or instructor postings at Seton Hall require a doctorate, and does that differ by department?',
      'One current Seton Hall posting for MBA workshops (through the English department) lists PhD required. Need to know whether marketing sets the same bar.'
    )
) as q(sort_order, question, why_it_matters)
where s.slug = 'seton-hall'
  and not exists (
    select 1
    from jasonos.professor_questions existing
    where existing.school_id = s.id
      and existing.sort_order = q.sort_order
  );

insert into jasonos.professor_decisions (
  sort_order, title, why_it_matters, options, depends_on_question_ids
)
select
  1,
  'Teaching-first entry vs doctorate-first',
  'Sets the near-term investment of time, money, and identity. Teaching-first creates entry and proof; doctorate-first commits three to five years before any classroom time.',
  '[
    {
      "name": "Teaching-first (adjunct, guest lecture, executive education)",
      "pros": "Faster entry. Uses existing experience. Low cost. Tests fit before any degree spend.",
      "cons": "May cap at adjunct or lecturer. Pay varies. Still subject to the credential floor."
    },
    {
      "name": "Doctorate-first (DBA or PhD, then faculty search)",
      "pros": "Opens tenure-line and full-time roles. Strongest long-term standing.",
      "cons": "Three to five years. High cost. Research expectations do not match practitioner strengths."
    }
  ]'::jsonb,
  array[
    (select pq.id from jasonos.professor_questions pq
      join jasonos.professor_schools s on s.id = pq.school_id
      where s.slug = 'seton-hall' and pq.sort_order = 1),
    (select pq.id from jasonos.professor_questions pq
      join jasonos.professor_schools s on s.id = pq.school_id
      where s.slug = 'seton-hall' and pq.sort_order = 2),
    (select pq.id from jasonos.professor_questions pq
      join jasonos.professor_schools s on s.id = pq.school_id
      where s.slug = 'seton-hall' and pq.sort_order = 5)
  ]
where not exists (
  select 1 from jasonos.professor_decisions
  where sort_order = 1 and title = 'Teaching-first entry vs doctorate-first'
);

insert into jasonos.professor_decisions (
  sort_order, title, why_it_matters, options, depends_on_question_ids
)
select
  2,
  'Master''s gap plan',
  'Decides whether Jason''s existing Master of Architecture is enough, or whether an MBA or MS Marketing becomes a blocking dependency for adjunct entry.',
  '[
    {
      "name": "Current credentials are enough",
      "pros": "No new spend. Apply now.",
      "cons": "Only true if Stillman accepts a non-business master''s plus experience."
    },
    {
      "name": "Add an MBA or MS Marketing",
      "pros": "Removes the credential objection at any AACSB school.",
      "cons": "One to two years part-time. Significant cost. Delays entry."
    },
    {
      "name": "Plan a DBA later with explicit criteria",
      "pros": "Keeps full-time faculty optional. DBA fits practitioner identity.",
      "cons": "Premature until teaching fit is proven."
    }
  ]'::jsonb,
  array[
    (select pq.id from jasonos.professor_questions pq
      join jasonos.professor_schools s on s.id = pq.school_id
      where s.slug = 'seton-hall' and pq.sort_order = 1),
    (select pq.id from jasonos.professor_questions pq
      join jasonos.professor_schools s on s.id = pq.school_id
      where s.slug = 'seton-hall' and pq.sort_order = 7)
  ]
where not exists (
  select 1 from jasonos.professor_decisions
  where sort_order = 2 and title = 'Master''s gap plan'
);

insert into jasonos.professor_school_people (
  school_id, name, title, role_kind
)
select s.id, p.name, p.title, p.role_kind
from jasonos.professor_schools s
cross join (
  values
    ('Daniel Ladik', 'Department Chair and Associate Professor, Department of Marketing', 'chair'),
    ('JoAnne Beiter', 'Marketing Instructor', 'practitioner'),
    ('Adam Warner', 'Lecturer of Marketing', 'practitioner'),
    ('Gary Kritz', 'Associate Professor of Marketing', 'faculty'),
    ('Hector Lozada-Vega', 'Associate Professor of Marketing', 'faculty'),
    ('Mary Kate Naatus', 'Associate Professor of Marketing; Associate Provost, Dean of Continuing Education', 'faculty'),
    ('Stephen Pirog', 'Associate Professor of Marketing', 'faculty'),
    ('Debra Lee Surface', 'Assistant Professor of Marketing', 'faculty')
) as p(name, title, role_kind)
where s.slug = 'seton-hall'
on conflict (school_id, name) do update set
  title = excluded.title,
  role_kind = excluded.role_kind;

insert into jasonos.professor_school_postings (
  school_id, title, url, department, degree_required
)
select
  s.id,
  'Adjunct Instructor of MBA Workshops',
  'https://jobs.shu.edu/en-us/job/496683/adjunct-instructor-of-mba-workshops',
  'English (teaching Stillman MBA students)',
  'PhD required'
from jasonos.professor_schools s
where s.slug = 'seton-hall'
on conflict (school_id, url) do update set
  title = excluded.title,
  department = excluded.department,
  degree_required = excluded.degree_required;

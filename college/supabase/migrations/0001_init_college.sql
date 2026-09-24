-- Kyle college portal. Isolated from jasonos and public.
-- Service role only. No policies for anon or authenticated, so a family
-- login on this Supabase project cannot read these tables through the API
-- until a real auth policy is added. The app server uses the service role.

create schema if not exists college;

create table if not exists college.app_state (
  id text primary key,
  checklist jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into college.app_state (id)
values ('kyle-college')
on conflict (id) do nothing;

create table if not exists college.schools (
  id text primary key,
  name text not null,
  location text not null default '',
  campus_size text not null default '',
  mechanical_engineering text not null default '',
  materials text not null default '',
  materials_offering text not null default '',
  admissions_context text not null default '',
  sat_context text not null default '',
  selectivity text not null default '',
  notes text not null default '',
  list_order integer not null default 0,
  choice text not null default 'unsure',
  plan text not null default '',
  visited boolean not null default false,
  visit_date date,
  visit_notes text not null default '',
  deadline date,
  deadline_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_choice_check check (choice in ('top', 'middle', 'low', 'backup', 'unsure')),
  constraint schools_plan_check check (plan in ('', 'ed', 'ea', 'rd', 'rolling'))
);

create table if not exists college.school_steps (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references college.schools(id) on delete cascade,
  label text not null,
  owner text not null default 'kyle',
  done boolean not null default false,
  sort_order integer not null default 0,
  constraint school_steps_owner_check check (owner in ('kyle', 'jason', 'wife'))
);

create index if not exists school_steps_school_id_idx on college.school_steps (school_id, sort_order);

insert into college.schools (
  id, name, location, campus_size, mechanical_engineering, materials,
  materials_offering, admissions_context, sat_context, selectivity, notes, list_order
) values
('mit', 'Massachusetts Institute of Technology (MIT)', 'Cambridge, MA', 'Urban / Small', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1530–1580', 'Extreme Reach', 'Elite engineering; keep as aspirational option', 1),
('stanford-university', 'Stanford University', 'Stanford, CA', 'Suburban / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1510–1570', 'Extreme Reach', 'Broad engineering + materials flexibility', 2),
('uc-berkeley', 'University of California, Berkeley (UC Berkeley)', 'Berkeley, CA', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', 'Test-free', 'Extreme Reach', 'Outstanding materials and mechanical programs', 3),
('cornell-university', 'Cornell University', 'Ithaca, NY', 'College town / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1510–1570', 'Extreme Reach', 'Excellent fit for combined mechanical/materials interests', 4),
('northwestern-university', 'Northwestern University', 'Evanston, IL', 'Suburban / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1500–1560', 'Extreme Reach', 'Especially notable materials program', 5),
('cmu', 'Carnegie Mellon University (CMU)', 'Pittsburgh, PA', 'Urban / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1510–1570', 'Extreme Reach', 'Robotics/research interests make this especially relevant', 6),
('upenn', 'University of Pennsylvania (UPenn)', 'Philadelphia, PA', 'Urban / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Extremely selective', '~1510–1560', 'Extreme Reach', 'Small engineering school within larger university', 7),
('johns-hopkins-university', 'Johns Hopkins University', 'Baltimore, MD', 'Urban / Medium', 'Yes', 'Yes', 'Materials-related degree/path', 'Extremely selective', '~1530–1570', 'Extreme Reach', 'Research-intensive; verify exact current undergraduate materials structure', 8),
('georgia-tech', 'Georgia Institute of Technology (Georgia Tech)', 'Atlanta, GA', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Very selective, especially out-of-state', '~1370–1530', 'Reach', 'Exceptional strength in both mechanical and materials', 9),
('university-of-michigan-ann-arbor', 'University of Michigan–Ann Arbor', 'Ann Arbor, MI', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Engineering reports ~14% admit rate', '1430 median Engineering', 'Reach', 'Excellent breadth; holistic engineering review', 10),
('uiuc', 'University of Illinois Urbana-Champaign (UIUC)', 'Champaign-Urbana, IL', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Grainger Engineering highly selective', '~1480–1550 Engineering', 'Reach', 'Top-tier in both fields; also MSE + Data Science option', 11),
('ut-austin', 'University of Texas at Austin (UT Austin)', 'Austin, TX', 'Urban / Very Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Very selective for out-of-state engineering', 'High', 'Reach', 'Excellent engineering; OOS admission is difficult', 12),
('ucla', 'University of California, Los Angeles (UCLA)', 'Los Angeles, CA', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Engineering extremely selective', 'Test-free', 'Extreme Reach', 'Strong materials + mechanical; UC test-free admissions', 13),
('purdue-university', 'Purdue University', 'West Lafayette, IN', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'First-Year Engineering; competitive transition', '~1380–1520 Engineering', 'Reach / High Target', 'Very strong option; first-year engineering lets students explore disciplines', 14),
('university-of-maryland-college-park', 'University of Maryland, College Park', 'College Park, MD', 'Suburban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive engineering', '~1380–1520', 'High Target', 'Strong research access near DC', 15),
('university-of-washington', 'University of Washington', 'Seattle, WA', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive direct-to-engineering pathway', 'Test optional', 'Reach', 'Excellent materials research ecosystem', 16),
('university-of-wisconsin-madison', 'University of Wisconsin–Madison', 'Madison, WI', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive engineering', '~1370–1500', 'High Target', 'Strong traditional engineering + college-town experience', 17),
('virginia-tech', 'Virginia Polytechnic Institute and State University (Virginia Tech)', 'Blacksburg, VA', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive engineering', '~1240–1430', 'High Target', 'Hands-on engineering culture', 18),
('penn-state', 'Pennsylvania State University (Penn State)', 'University Park, PA', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Strong engineering; broader admission than top reaches', '~1250–1430', 'Target', 'Particularly strong materials reputation', 19),
('ohio-state-university', 'Ohio State University', 'Columbus, OH', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive', '~1310–1480', 'Target', 'Large engineering resources and research', 20),
('university-of-minnesota-twin-cities', 'University of Minnesota Twin Cities', 'Minneapolis, MN', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive', '~1350–1490', 'Target', 'Materials program has strong industry/research links', 21),
('nc-state', 'North Carolina State University (NC State)', 'Raleigh, NC', 'Urban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive engineering', '~1290–1450', 'High Target', 'Strong engineering + Research Triangle access', 22),
('uc-davis', 'University of California, Davis (UC Davis)', 'Davis, CA', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Selective', 'Test-free', 'Target', 'Good balance of engineering and college-town campus', 23),
('uc-irvine', 'University of California, Irvine (UC Irvine)', 'Irvine, CA', 'Suburban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Selective engineering', 'Test-free', 'Target', 'Materials opportunities within engineering', 24),
('case-western-reserve-university', 'Case Western Reserve University', 'Cleveland, OH', 'Urban / Small', 'Yes', 'Yes', 'Standalone undergraduate', 'Selective', '~1420–1520', 'Target', 'Smaller private research university; good STEM fit', 25),
('rpi', 'Rensselaer Polytechnic Institute (RPI)', 'Troy, NY', 'Small city / Small', 'Yes', 'Yes', 'Standalone undergraduate', 'Selective', '~1360–1500', 'Target', 'Small STEM-focused environment', 26),
('rutgers-university-new-brunswick', 'Rutgers University–New Brunswick', 'New Brunswick, NJ', 'Suburban / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'School of Engineering admission', 'Test optional', 'Target', 'Kyle attended Rutgers Honors Engineering eXperience (R-HEX); useful benchmark school', 27),
('university-of-florida', 'University of Florida', 'Gainesville, FL', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Competitive', '~1330–1470', 'High Target', 'Large, broad engineering college', 28),
('texas-a-and-m-university', 'Texas A&M University', 'College Station, TX', 'College town / Very Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Engineering entry pathway', '~1160–1390', 'Target', 'Large engineering ecosystem; review entry-to-major process', 29),
('colorado-school-of-mines', 'Colorado School of Mines', 'Golden, CO', 'Suburban / Small', 'Yes', 'Yes', 'Standalone materials/metallurgical', 'Selective STEM-focused', '~1330–1490', 'Target', 'STEM-focused; strong materials/metallurgy identity', 30),
('uva', 'University of Virginia (UVA)', 'Charlottesville, VA', 'College town / Medium', 'Yes', 'Yes', 'Materials-related undergraduate pathway', 'Very selective out-of-state', '~1410–1530', 'Reach', 'Strong engineering; verify standalone degree structure for application year', 31),
('lehigh-university', 'Lehigh University', 'Bethlehem, PA', 'Small city / Small', 'Yes', 'Yes', 'Standalone undergraduate', 'Selective', '~1360–1490', 'Target', 'Smaller private engineering environment', 32),
('uconn', 'University of Connecticut (UConn)', 'Storrs, CT', 'College town / Large', 'Yes', 'Yes', 'Materials-related undergraduate/path', 'Competitive', '~1220–1440', 'Target', 'Good Northeast option; verify exact current degree title', 33),
('university-of-delaware', 'University of Delaware', 'Newark, DE', 'College town / Medium', 'Yes', 'No', 'Materials coursework / research, no standalone MSE BS', 'Competitive', '~1190–1360', 'Likely / Target', 'Good mechanical option if materials becomes secondary', 34),
('drexel-university', 'Drexel University', 'Philadelphia, PA', 'Urban / Medium', 'Yes', 'Yes', 'Standalone undergraduate', 'Moderate', '~1240–1470', 'Likely / Target', 'Co-op is a major differentiator', 35),
('iowa-state-university', 'Iowa State University', 'Ames, IA', 'College town / Large', 'Yes', 'Yes', 'Standalone undergraduate', 'Broad access', '~1100–1330', 'Likely', 'Strong engineering safety/likely candidate to investigate', 36),
('clemson-university', 'Clemson University', 'Clemson, SC', 'College town / Large', 'Yes', 'Yes', 'Materials Science & Engineering', 'Competitive', '~1250–1400', 'Target', 'Strong engineering and traditional campus environment', 37),
('university-of-tennessee-knoxville', 'University of Tennessee, Knoxville', 'Knoxville, TN', 'Urban / Large', 'Yes', 'Yes', 'Materials Science & Engineering', 'Moderate', '~1240–1400', 'Likely / Target', 'Materials research links to Oak Ridge region', 38),
('michigan-tech', 'Michigan Technological University (Michigan Tech)', 'Houghton, MI', 'Small town / Small', 'Yes', 'Yes', 'Standalone undergraduate', 'Broad access', '~1130–1350', 'Likely', 'Very engineering-focused; remote location is a major campus-fit factor', 39),
('njit', 'New Jersey Institute of Technology (NJIT)', 'Newark, NJ', 'Urban / Medium', 'Yes', 'No', 'Materials pathway / coursework rather than standalone MSE BS', 'Broad access', '~1190–1450', 'Likely', 'Local engineering-focused likely option', 40),
('wpi', 'Worcester Polytechnic Institute (WPI)', 'Worcester, MA', 'Small city / Small', 'Yes', 'No', 'Materials concentration/coursework', 'Engineering-focused', 'Test optional', 'Target', 'Project-based curriculum fits robotics/research interests', 41),
('stevens-institute-of-technology', 'Stevens Institute of Technology', 'Hoboken, NJ', 'Urban / Small', 'Yes', 'No', 'Materials concentration/coursework', 'Engineering-focused', '~1380–1510', 'Target', 'Small STEM school; strong proximity to NYC industry', 42),
('rose-hulman-institute-of-technology', 'Rose-Hulman Institute of Technology', 'Terre Haute, IN', 'Small city / Small', 'Yes', 'No', 'Materials minor/coursework', 'Engineering-focused', '~1320–1490', 'Target', 'Undergraduate-only STEM focus; excellent teaching emphasis', 43)
on conflict (id) do nothing;

alter table college.app_state enable row level security;
alter table college.schools enable row level security;
alter table college.school_steps enable row level security;

revoke all on schema college from public, anon, authenticated;
revoke all on all tables in schema college from public, anon, authenticated;
grant usage on schema college to service_role;
grant all on all tables in schema college to service_role;
grant all on all sequences in schema college to service_role;
alter default privileges in schema college grant all on tables to service_role;
alter default privileges in schema college grant all on sequences to service_role;

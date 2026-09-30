-- Fill known data gaps from data already in the repo, and turn on Row Level Security for five tables.
-- Prepared September 29, 2026 from the live database, data/finances.json and data/metro-populations.json.

-- 1. Metro area and population (CBSA entries from data/metro-populations.json). Only fills blanks.
update college.schools set metro_area = 'Ithaca, NY', metro_population = 104047, updated_at = now() where id = 'cornell-university' and metro_area is null;
update college.schools set metro_area = 'Ann Arbor, MI', metro_population = 370214, updated_at = now() where id = 'university-of-michigan-ann-arbor' and metro_area is null;
update college.schools set metro_area = 'Champaign-Urbana, IL', metro_population = 239979, updated_at = now() where id = 'uiuc' and metro_area is null;
update college.schools set metro_area = 'Lafayette-West Lafayette, IN', metro_population = 228468, updated_at = now() where id = 'purdue-university' and metro_area is null;
update college.schools set metro_area = 'Madison, WI', metro_population = 709685, updated_at = now() where id = 'university-of-wisconsin-madison' and metro_area is null;
update college.schools set metro_area = 'Blacksburg-Christiansburg-Radford, VA', metro_population = 181616, updated_at = now() where id = 'virginia-tech' and metro_area is null;
update college.schools set metro_area = 'State College, PA', metro_population = 157393, updated_at = now() where id = 'penn-state' and metro_area is null;
update college.schools set metro_area = 'Sacramento-Roseville-Folsom, CA', metro_population = 2477274, updated_at = now() where id = 'uc-davis' and metro_area is null;
update college.schools set metro_area = 'College Station-Bryan, TX', metro_population = 287476, updated_at = now() where id = 'texas-a-and-m-university' and metro_area is null;
update college.schools set metro_area = 'Charlottesville, VA', metro_population = 228597, updated_at = now() where id = 'uva' and metro_area is null;
update college.schools set metro_area = 'Hartford-West Hartford-East Hartford, CT', metro_population = 1171426, updated_at = now() where id = 'uconn' and metro_area is null;
update college.schools set metro_area = 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD', metro_population = 6329118, updated_at = now() where id = 'university-of-delaware' and metro_area is null;
update college.schools set metro_area = 'Ames, IA', metro_population = 128090, updated_at = now() where id = 'iowa-state-university' and metro_area is null;
update college.schools set metro_area = 'Greenville-Anderson-Greer, SC', metro_population = 1014101, updated_at = now() where id = 'clemson-university' and metro_area is null;
update college.schools set metro_area = 'Houghton, MI', metro_population = 40028, updated_at = now() where id = 'michigan-tech' and metro_area is null;

-- 2. Middle 50%. Maryland and Tennessee copy the SAT range already in sat_context. The UCs do not consider scores.
update college.schools set middle_50 = sat_context, updated_at = now() where id = 'university-of-maryland-college-park' and coalesce(middle_50, '') = '';
update college.schools set middle_50 = sat_context, updated_at = now() where id = 'university-of-tennessee-knoxville' and coalesce(middle_50, '') = '';
update college.schools set middle_50 = 'Not considered (test-blind)', updated_at = now() where id in ('uc-berkeley', 'uc-davis', 'uc-irvine', 'ucla') and coalesce(middle_50, '') = '';

-- 3. Selectivity tier for all active schools, from one rule: under 12% extremely selective, 12-30% very selective, 30-60% competitive, over 60% less competitive.
-- Rate used: rate_that_applies_to_kyle, or overall_admit_rate when that is blank (Michigan and Colorado School of Mines). This replaces existing tiers on purpose.
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'mit'; -- Massachusetts Institute of Technology (MIT): 4.5%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'stanford-university'; -- Stanford University: 3.6%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'uc-berkeley'; -- University of California, Berkeley (UC Berkeley): 10.3%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'cornell-university'; -- Cornell University: 8.8%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'northwestern-university'; -- Northwestern University: 7.7%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'cmu'; -- Carnegie Mellon University (CMU): 11.7%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'upenn'; -- University of Pennsylvania (UPenn): 5.4%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'johns-hopkins-university'; -- Johns Hopkins University: 6.4%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'georgia-tech'; -- Georgia Institute of Technology (Georgia Tech): 9%
update college.schools set selectivity_tier = 'very_selective', updated_at = now() where id = 'university-of-michigan-ann-arbor'; -- University of Michigan–Ann Arbor: 16.4%
update college.schools set selectivity_tier = 'very_selective', updated_at = now() where id = 'uiuc'; -- University of Illinois Urbana-Champaign (UIUC): 29%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'ut-austin'; -- University of Texas at Austin (UT Austin): 7.5%
update college.schools set selectivity_tier = 'extremely_selective', updated_at = now() where id = 'ucla'; -- University of California, Los Angeles (UCLA): 11.2%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'purdue-university'; -- Purdue University: 43.6%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'university-of-maryland-college-park'; -- University of Maryland, College Park: 45.5%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'university-of-washington'; -- University of Washington: 42.2%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'university-of-wisconsin-madison'; -- University of Wisconsin–Madison: 40.3%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'virginia-tech'; -- Virginia Polytechnic Institute and State University (Virginia Tech): 62.8%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'penn-state'; -- Pennsylvania State University (Penn State): 53.3%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'ohio-state-university'; -- Ohio State University: 46.4%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'university-of-minnesota-twin-cities'; -- University of Minnesota Twin Cities: 85.3%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'nc-state'; -- North Carolina State University (NC State): 34.4%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'uc-davis'; -- University of California, Davis (UC Davis): 63.2%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'uc-irvine'; -- University of California, Irvine (UC Irvine): 47.4%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'case-western-reserve-university'; -- Case Western Reserve University: 36.5%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'rpi'; -- Rensselaer Polytechnic Institute (RPI): 63.5%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'rutgers-university-new-brunswick'; -- Rutgers University–New Brunswick: 62.3%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'texas-a-and-m-university'; -- Texas A&M University: 41.3%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'colorado-school-of-mines'; -- Colorado School of Mines: 61%
update college.schools set selectivity_tier = 'very_selective', updated_at = now() where id = 'uva'; -- University of Virginia (UVA): 14.3%
update college.schools set selectivity_tier = 'very_selective', updated_at = now() where id = 'lehigh-university'; -- Lehigh University: 25.9%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'uconn'; -- University of Connecticut (UConn): 58.5%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'university-of-delaware'; -- University of Delaware: 70%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'drexel-university'; -- Drexel University: 79.4%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'iowa-state-university'; -- Iowa State University: 91.1%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'clemson-university'; -- Clemson University: 40.3%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'university-of-tennessee-knoxville'; -- University of Tennessee, Knoxville: 35.1%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'michigan-tech'; -- Michigan Technological University (Michigan Tech): 81.6%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'njit'; -- New Jersey Institute of Technology (NJIT): 68.7%
update college.schools set selectivity_tier = 'less_competitive', updated_at = now() where id = 'wpi'; -- Worcester Polytechnic Institute (WPI): 60.2%
update college.schools set selectivity_tier = 'competitive', updated_at = now() where id = 'university-of-pittsburgh'; -- University of Pittsburgh: 58.1%

-- 4. Merit aid notes. Replace the application fee text (the fee already shows from Scoir on the Requirements tab) and blanks with a summary from data/finances.json.
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'mit';
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'stanford-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Regents'' and Chancellor''s Scholarship. 4% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uc-berkeley';
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'cornell-university';
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'northwestern-university';
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'cmu';
update college.schools set merit_aid_notes = 'No merit scholarships; aid is need-based only.', updated_at = now() where id = 'upenn';
update college.schools set merit_aid_notes = 'Merit scholarships: Charles R. Westgate Scholarship in Engineering; Hodson Trust Scholarship. 4% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'johns-hopkins-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Stamps President''s Scholarship; Gold Scholars Program; Provost Scholarship. 9% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'georgia-tech';
update college.schools set merit_aid_notes = 'Merit scholarships: Joseph M. Geisinger Scholarship; Engineering Scholarship of Honor. 17% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'university-of-michigan-ann-arbor';
update college.schools set merit_aid_notes = 'Merit scholarships: Stamps Scholarship; Provost Scholarship; Grainger College of Engineering first-year merit scholarships; Matthews Scholars. 16% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uiuc';
update college.schools set merit_aid_notes = 'Merit scholarships: Cockrell School of Engineering merit scholarships; University-wide general scholarships and college/school awards.', updated_at = now() where id = 'ut-austin';
update college.schools set merit_aid_notes = 'Merit scholarships: UCLA Samueli Engineering Scholarships. 7% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'ucla';
update college.schools set merit_aid_notes = 'Merit scholarships: Trustees Scholarship; Presidential Scholarship; Lilly Scholars at Purdue Program; National Recognition Programs Scholarship. 21% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'purdue-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Banneker/Key Scholarship; President''s Scholarship; A. James Clark Scholars Program; Clark School of Engineering Scholarships. 22% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'university-of-maryland-college-park';
update college.schools set merit_aid_notes = 'Merit scholarships: Purple & Gold Scholarship; UW Honors Program scholarships. 10% of first-year students received a merit award without financial need (2024-25 Common Data Set).', updated_at = now() where id = 'university-of-washington';
update college.schools set merit_aid_notes = 'Merit scholarships: Engineering Freshman Award; College of Engineering Departmental Scholarships. 8% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'university-of-wisconsin-madison';
update college.schools set merit_aid_notes = 'Merit scholarships: College of Engineering first-year scholarships; Beyond Boundaries Scholars / VT Scholars.', updated_at = now() where id = 'virginia-tech';
update college.schools set merit_aid_notes = 'Merit scholarships: Schreyer Honors College Academic Excellence Scholarship; Provost Academic Award. 6% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'penn-state';
update college.schools set merit_aid_notes = 'Merit scholarships: Stamps Eminence Scholarship; Morrill Scholarship Program (Distinction / Prominence); National Buckeye Scholarship; Maximus, Provost and Trustees Scholarships. 30% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'ohio-state-university';
update college.schools set merit_aid_notes = 'Merit scholarships: National Scholarship; Presidential Scholarship; Gold Scholar Award; Bentson Family Scholarship; and 2 more. 13% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'university-of-minnesota-twin-cities';
update college.schools set merit_aid_notes = 'Merit scholarships: Park Scholarship; Shelton Scholars Program; Chancellor''s Leadership Scholarship. 5% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'nc-state';
update college.schools set merit_aid_notes = 'Merit scholarships: Regents Scholarship; Provost Award. 5% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uc-davis';
update college.schools set merit_aid_notes = 'Merit scholarships: Directors'' Scholarship; Henry Samueli Endowed Scholarship. 3% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uc-irvine';
update college.schools set merit_aid_notes = 'Merit scholarships: Milton A. and Roslyn Z. Wolf Scholarship; A.W. Smith Innovation Scholarship; Louis Stokes Congressional Black Caucus Foundation Scholarship; FIRST Scholarship; and 2 more. 40% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'case-western-reserve-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Rensselaer Medal Award; Rensselaer Leadership Award; Rensselaer Garnet Baltimore Award; Rensselaer Recognition Award.', updated_at = now() where id = 'rpi';
update college.schools set merit_aid_notes = 'Merit scholarships: First-Year Student Scholarship Award; Rutgers Presidential Scholarship (Honors College); Harvey Schwartz Scholarship; College-Sponsored Merit Scholarship (National Merit).', updated_at = now() where id = 'rutgers-university-new-brunswick';
update college.schools set merit_aid_notes = 'Merit scholarships: National Merit Finalist guaranteed package (President''s Endowed Scholarship, National Merit Recognition Scholarship, National Merit Sponsorship); President''s Endowed Scholarship (National Merit Semifinalists); Opportunity Award; Academic Scholarships; and 2 more. 14% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'texas-a-and-m-university';
update college.schools set merit_aid_notes = 'Merit scholarships: President''s Scholarship; Provost Award; General Scholarship Application (donor and departmental scholarships).', updated_at = now() where id = 'colorado-school-of-mines';
update college.schools set merit_aid_notes = 'Merit scholarships: Jefferson Scholarship (Jefferson Scholars Foundation). 2% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uva';
update college.schools set merit_aid_notes = 'Merit scholarships: Founder''s and Trustees'' Scholarships; Dean''s Scholarship; Lehigh University Merit Scholarship / National Merit Scholarship. 12% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'lehigh-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Stamps Scholarship; STEM Scholarship; Academic Excellence Scholarship; Husky Achievement Award; and 2 more. 27% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'uconn';
update college.schools set merit_aid_notes = 'Merit scholarships: UD Trustee Scholarship; UD Presidential Scholarship; UD Provost Scholarship; Delaware Scholar Award; and 2 more. 32% of first-year students received a merit award without financial need (2024-25 Common Data Set).', updated_at = now() where id = 'university-of-delaware';
update college.schools set merit_aid_notes = 'Merit scholarships: Drexel Merit Scholarship; FIRST Robotics Scholarship; Dragon Alumni Scholarship; Materials Summer Institute Scholarship. 25% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'drexel-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Academic Achievement Award; Exploration Award; College of Engineering Incoming Freshman Scholarship; Generations Award; and 1 more. 43% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'iowa-state-university';
update college.schools set merit_aid_notes = 'Merit scholarships: National Scholars Program; Lyceum Scholars Program; Out-of-state first-year recruiting scholarship; Clemson-Sponsored National Merit Finalist Scholarship; and 1 more.', updated_at = now() where id = 'clemson-university';
update college.schools set merit_aid_notes = 'Merit scholarships: Out-of-State Volunteer Scholarship; Chancellor''s Scholarships (Neyland, Roddy, Tennessee Scholars, Bonham, Manning); Provost Scholarship; Tickle College of Engineering scholarships; and 1 more. 53% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'university-of-tennessee-knoxville';
update college.schools set merit_aid_notes = 'Merit scholarships: Leading Scholar Award; National Scholars Program; FIRST Scholarship (FIRST or VEX Robotics); Alumni Legacy Award; and 1 more. 41% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'michigan-tech';
update college.schools set merit_aid_notes = 'Merit scholarships: Faculty Scholarship; Dean''s Scholarship; Honors Merit Award (Albert Dorman Honors College); Honors Residential Scholarship; and 2 more. 18% of first-year students received a merit award without financial need (2024-25 Common Data Set).', updated_at = now() where id = 'njit';
update college.schools set merit_aid_notes = 'Merit scholarships: Presidential Scholarship; Regional Scholarship; Robotics Engineering Scholars Program; Chemical Engineering Scholars Program (CHESP); and 2 more. 41% of first-year students received a merit award without financial need (2025-26 Common Data Set).', updated_at = now() where id = 'wpi';
update college.schools set merit_aid_notes = '', updated_at = now() where id = 'university-of-pittsburgh';

-- 5. Cost of attendance where blank, from data/finances.json (the school's published budget).
update college.schools set cost_of_attendance = '$93,944 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'uc-berkeley' and coalesce(cost_of_attendance, '') = '';
update college.schools set cost_of_attendance = '$84,770 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'ucla' and coalesce(cost_of_attendance, '') = '';
update college.schools set cost_of_attendance = '$65,520 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'university-of-maryland-college-park' and coalesce(cost_of_attendance, '') = '';
update college.schools set cost_of_attendance = '$88,279 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'uc-davis' and coalesce(cost_of_attendance, '') = '';
update college.schools set cost_of_attendance = '$84,476 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'uc-irvine' and coalesce(cost_of_attendance, '') = '';
update college.schools set cost_of_attendance = '$57,448 out-of-state cost of attendance, 2026-27 (school budget)', updated_at = now() where id = 'university-of-tennessee-knoxville' and coalesce(cost_of_attendance, '') = '';

-- 6. Pitt: Programs and Admissions by residency were marked complete while those fields are blank.
update college.schools set research_completed = array_remove(array_remove(research_completed, 'Programs'), 'Admissions by residency'), updated_at = now() where id = 'university-of-pittsburgh';

-- 7. Row Level Security. The app reads and writes these tables only with the service role key, which bypasses RLS,
-- so no policies are needed. This matches college.schools and the other tables.
alter table college.member_prefs enable row level security;
alter table college.activity_log enable row level security;
alter table college.extraction_feedback enable row level security;
alter table college.travel_points_extra enable row level security;
alter table college.drive_pairs_extra enable row level security;

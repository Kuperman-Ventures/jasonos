-- Test policy for Fall 2028 entry.
alter table college.schools
  add column if not exists test_policy_fall2028_status text not null default '',
  add column if not exists test_policy_term text not null default '',
  add column if not exists test_policy_detail text not null default '',
  add column if not exists test_policy_change text,
  add column if not exists test_policy_source_url text not null default '',
  add column if not exists test_policy_checked_date text not null default '';

comment on column college.schools.test_policy is
  'Required | Required for some applicants | Optional | Not considered.';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent (foreseeable future)',
  test_policy_detail = 'All first-year applicants must submit the SAT or ACT; MIT superscores and has no separate engineering rule.',
  test_policy_change = 'Reinstated in March 2022, starting with the Class of 2027.',
  test_policy_source_url = 'https://mitadmissions.org/apply/firstyear/tests-scores/',
  test_policy_checked_date = '2026-09-27'
where name = 'Massachusetts Institute of Technology (MIT)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All first-year applicants must self-report SAT or ACT scores; students who enroll then send official scores.',
  test_policy_change = 'Announced June 7, 2024; testing had been optional for Fall 2025 entry.',
  test_policy_source_url = 'https://admission.stanford.edu/apply/first-year/testing.html',
  test_policy_checked_date = '2026-09-27'
where name = 'Stanford University';

update college.schools set
  test_policy = 'Not considered',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'SAT and ACT scores are not used in admission or scholarship decisions for any applicant, including engineering.',
  test_policy_change = 'On July 22, 2026, the University of California said its Academic Senate is reviewing testing and will make a recommendation to the Regents by June 2027; Fall 2028 is not decided.',
  test_policy_source_url = 'https://www.universityofcalifornia.edu/news/press-releases-and-statements/academic-senate-review-admissions',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of California, Berkeley (UC Berkeley)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All eight colleges, including Engineering, require SAT or ACT scores; self-reported scores are accepted.',
  test_policy_change = 'Announced April 22, 2024; Engineering had been test-optional for Fall 2025 entry.',
  test_policy_source_url = 'https://admissions.cornell.edu/policies/standardized-testing-policy',
  test_policy_checked_date = '2026-09-27'
where name = 'Cornell University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants choose whether to send SAT or ACT scores; the McCormick School of Engineering has no separate rule.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://admissions.northwestern.edu/docs/winter_2026_counselor_update.pdf',
  test_policy_checked_date = '2026-09-27'
where name = 'Northwestern University';

update college.schools set
  test_policy = 'Required for some applicants',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'Engineering applicants must submit at least one test score, which can be the SAT, ACT, AP, IB or A-Level; only the School of Computer Science requires the SAT or ACT.',
  test_policy_change = 'Announced August 29, 2024, replacing test-optional admission.',
  test_policy_source_url = 'https://www.cmu.edu/admission/admission/standardized-testing',
  test_policy_checked_date = '2026-09-27'
where name = 'Carnegie Mellon University (CMU)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All first-year applicants must submit SAT or ACT scores; applicants who cannot reach a test site can request a waiver.',
  test_policy_change = 'Announced February 14, 2025.',
  test_policy_source_url = 'https://admissions.upenn.edu/how-to-apply/preparing-your-application/testing',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Pennsylvania (UPenn)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All first-year applicants must submit SAT or ACT scores, which Hopkins superscores; there is no separate engineering rule.',
  test_policy_change = 'Announced August 16, 2024.',
  test_policy_source_url = 'https://apply.jhu.edu/how-to-apply/application-deadlines-requirements/standardized-testing/',
  test_policy_checked_date = '2026-09-27'
where name = 'Johns Hopkins University';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All first-year applicants must submit the SAT or ACT; AP, IB and CLT scores do not replace it.',
  test_policy_change = 'University System of Georgia policy requires tests at Georgia Tech for Fall 2026 and later.',
  test_policy_source_url = 'https://admission.gatech.edu/first-year/standardized-tests',
  test_policy_checked_date = '2026-09-27'
where name = 'Georgia Institute of Technology (Georgia Tech)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent (standing policy)',
  test_policy_detail = 'Applicants to all colleges, including Engineering, choose whether to submit SAT or ACT scores.',
  test_policy_change = 'Adopted as a standing policy on February 21, 2024.',
  test_policy_source_url = 'https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines/application-changes',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Michigan–Ann Arbor';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'SAT or ACT scores are optional for all majors, including engineering; submitted scores are used in admission and scholarships.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.admissions.illinois.edu/faq/applicant-freshman',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Illinois Urbana-Champaign (UIUC)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2025 entry, no end date',
  test_policy_detail = 'All first-year applicants, in-state and out-of-state, must send official SAT, ACT or CLT scores.',
  test_policy_change = 'Announced March 11, 2024.',
  test_policy_source_url = 'https://admissions.utexas.edu/standardized-testing-policy-FAQ',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of Texas at Austin (UT Austin)';

update college.schools set
  test_policy = 'Not considered',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'SAT and ACT scores are not used in admission or scholarship decisions for any applicant, including engineering.',
  test_policy_change = 'On July 22, 2026, the University of California said its Academic Senate is reviewing testing and will make a recommendation to the Regents by June 2027; Fall 2028 is not decided.',
  test_policy_source_url = 'https://www.universityofcalifornia.edu/news/press-releases-and-statements/academic-senate-review-admissions',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of California, Los Angeles (UCLA)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Purdue expects SAT, ACT or CLT scores from all first-year applicants and admits students without scores only in exceptional cases.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://admissions.purdue.edu/become-student/guide/',
  test_policy_checked_date = '2026-09-27'
where name = 'Purdue University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'Applicants, including engineering applicants, choose whether to submit SAT or ACT scores.',
  test_policy_change = 'Extended several times; the latest extension ends with Fall 2027 entry.',
  test_policy_source_url = 'https://admissions.umd.edu/apply/freshman-application-faqs',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Maryland, College Park';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent',
  test_policy_detail = 'The test requirement was permanently removed, and scores give no advantage for direct admission to engineering.',
  test_policy_change = 'Announced June 11, 2020.',
  test_policy_source_url = 'https://admit.washington.edu/apply/first-year/how-to-apply/test-scores/',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of Washington';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Spring 2028 entry',
  test_policy_detail = 'Scores are not required for any program through Spring 2028 entry, and UW-Madison advises students to plan on taking a test.',
  test_policy_change = 'UW-Madison says the Fall 2028 policy has not been decided.',
  test_policy_source_url = 'https://admissions.wisc.edu/act_sat_faq/',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Wisconsin–Madison';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Through Fall 2028 entry',
  test_policy_detail = 'Applicants to all majors, including engineering, choose whether to submit SAT or ACT scores.',
  test_policy_change = 'Test-optional since Fall 2021 entry and extended through Fall 2028 entry.',
  test_policy_source_url = 'https://www.vt.edu/admissions/frequently-asked-questions/test-optional.html',
  test_policy_checked_date = '2026-09-27'
where name = 'Virginia Polytechnic Institute and State University (Virginia Tech)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2026 entry',
  test_policy_detail = 'Applicants to all majors, including engineering, choose whether to have SAT or ACT scores considered.',
  test_policy_change = 'The Faculty Senate extended test-optional admission through Fall 2026 (announced October 23, 2024); no later decision has been announced.',
  test_policy_source_url = 'https://www.psu.edu/resources/faq/test-optional',
  test_policy_checked_date = '2026-09-27'
where name = 'Pennsylvania State University (Penn State)';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2026 entry, no end date',
  test_policy_detail = 'All first-year applicants to the Columbus campus, including engineering, must submit ACT or SAT scores.',
  test_policy_change = 'Announced March 12, 2025, ending the test-optional policy adopted in 2020.',
  test_policy_source_url = 'https://news.osu.edu/ohio-state-shares-decision-on-test-requirements/',
  test_policy_checked_date = '2026-09-27'
where name = 'Ohio State University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'Applicants choose whether to submit ACT or SAT scores; there is no separate rule for engineering.',
  test_policy_change = 'The university describes this as a temporary policy through 2027 and has not announced Fall 2028.',
  test_policy_source_url = 'https://admissions.tc.umn.edu/admissions/freshman-admission/act-sat-information',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Minnesota Twin Cities';

update college.schools set
  test_policy = 'Required for some applicants',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2025 entry, no end date',
  test_policy_detail = 'Applicants with a weighted GPA of 2.8 or higher choose whether to submit scores; applicants with a weighted GPA from 2.5 to 2.8 must submit them.',
  test_policy_change = 'UNC System Policy 700.1.1, adopted May 23, 2024, effective Fall 2025 entry.',
  test_policy_source_url = 'https://admissions.ncsu.edu/apply/first-year/test-score-consideration-in-admission-decisions/',
  test_policy_checked_date = '2026-09-27'
where name = 'North Carolina State University (NC State)';

update college.schools set
  test_policy = 'Not considered',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'SAT and ACT scores are not used in admission or scholarship decisions for any applicant, including engineering.',
  test_policy_change = 'On July 22, 2026, the University of California said its Academic Senate is reviewing testing and will make a recommendation to the Regents by June 2027; Fall 2028 is not decided.',
  test_policy_source_url = 'https://www.universityofcalifornia.edu/news/press-releases-and-statements/academic-senate-review-admissions',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of California, Davis (UC Davis)';

update college.schools set
  test_policy = 'Not considered',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'SAT and ACT scores are not used in admission or scholarship decisions for any applicant, including engineering.',
  test_policy_change = 'On July 22, 2026, the University of California said its Academic Senate is reviewing testing and will make a recommendation to the Regents by June 2027; Fall 2028 is not decided.',
  test_policy_source_url = 'https://www.universityofcalifornia.edu/news/press-releases-and-statements/academic-senate-review-admissions',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'University of California, Irvine (UC Irvine)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'All applicants, including engineering, choose whether to apply with scores; this also covers scholarships.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://case.edu/admission/apply/application-requirements-enhancements/test-optional',
  test_policy_checked_date = '2026-09-27'
where name = 'Case Western Reserve University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Through Fall 2030 entry',
  test_policy_detail = 'Applicants choose whether to submit SAT or ACT scores, with no effect on merit aid; only the BS/MD program requires scores.',
  test_policy_change = 'Extended through Fall 2030 entry.',
  test_policy_source_url = 'https://undergrad.admissions.rpi.edu/prospective-students/prospective-students-frequently-asked-questions/fall-2027-admission-cycle-test',
  test_policy_checked_date = '2026-09-27'
where name = 'Rensselaer Polytechnic Institute (RPI)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'Scores are optional for New Brunswick applicants, including the School of Engineering.',
  test_policy_change = 'Rutgers says the policy runs through 2027 and has not announced Fall 2028.',
  test_policy_source_url = 'https://admissions.rutgers.edu/apply/first-year-applicants',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'Rutgers University–New Brunswick';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent (state regulation, no end date)',
  test_policy_detail = 'All first-year applicants must submit SAT, ACT or CLT scores, as required by Florida Board of Governors Regulation 6.002.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://admissions.ufl.edu/apply/freshman/requirements',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Florida';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants do not have to send SAT or ACT scores but are encouraged to send them if they have them; there is no separate engineering rule.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://admissions.tamu.edu/apply/freshman',
  test_policy_checked_date = '2026-09-27'
where name = 'Texas A&M University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants get equal consideration for admission and merit scholarships with or without scores.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://undergraduate-admissions.mines.edu/first-year/',
  test_policy_checked_date = '2026-09-27'
where name = 'Colorado School of Mines';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2026 entry',
  test_policy_detail = 'UVA is test-optional but renews the policy one admission cycle at a time.',
  test_policy_change = 'The newest official statement found covers Fall 2026 entry; UVA''s admissions site blocked automated reading, so a newer statement may exist.',
  test_policy_source_url = 'https://admission.virginia.edu/faq-2',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Virginia (UVA)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent (indefinite)',
  test_policy_detail = 'Lehigh has adopted test-optional admission indefinitely; there is no separate rule for engineering.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www2.lehigh.edu/admissions/admissions-requirements',
  test_policy_checked_date = '2026-09-27'
where name = 'Lehigh University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent (foreseeable future)',
  test_policy_detail = 'Applicants choose whether to submit SAT or ACT scores; there is no separate engineering rule.',
  test_policy_change = 'Started as a pilot in May 2020, renewed in July 2022, and now described as continuing for the foreseeable future.',
  test_policy_source_url = 'https://admissions.uconn.edu/apply/first-year/instructions/',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Connecticut (UConn)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'All applicants, including for merit awards and the Honors College, choose whether to send SAT or ACT scores.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.udel.edu/apply/undergraduate-admissions/apply-to-ud/freshman-admissions/',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Delaware';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Scores are optional, and under Drexel''s No Harm Test-Optional policy they are used only when they help the application.',
  test_policy_change = 'Adopted September 4, 2025.',
  test_policy_source_url = 'https://drexel.edu/admissions/apply/undergrad-instructions/first-year-instructions/standardized-tests',
  test_policy_checked_date = '2026-09-27'
where name = 'Drexel University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants choose whether to report ACT, SAT or CLT scores; engineering adds only a two-year world language requirement.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.iastate.edu/admission-and-aid/admissions/first-year-students',
  test_policy_checked_date = '2026-09-27'
where name = 'Iowa State University';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants choose whether to send SAT or ACT scores; there is no separate rule for engineering.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.clemson.edu/admissions/undergraduate-admissions/apply/first-year.html',
  test_policy_checked_date = '2026-09-27'
where name = 'Clemson University';

update college.schools set
  test_policy = 'Required',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'From Fall 2024 entry, no end date',
  test_policy_detail = 'All first-year applicants must report ACT or SAT scores; direct admission to engineering also requires at least a 25 ACT Math or 590 SAT Math.',
  test_policy_change = 'UT System Board of Trustees policy approved September 8, 2023.',
  test_policy_source_url = 'https://admissions.utk.edu/undergraduate-application/test-score-policy/',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Tennessee, Knoxville';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Domestic applicants do not need to send scores; applicants with a GPA below 3.0 may be asked for them.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.mtu.edu/admissions/apply/steps/',
  test_policy_checked_date = '2026-09-27'
where name = 'Michigan Technological University (Michigan Tech)';

update college.schools set
  test_policy = 'Required for some applicants',
  test_policy_fall2028_status = 'Not yet announced for Fall 2028',
  test_policy_term = 'Through Fall 2027 entry',
  test_policy_detail = 'Scores are optional for most applicants but required for the Albert Dorman Honors College and accelerated programs.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.njit.edu/admissions/how-we-evaluate-applicants',
  test_policy_checked_date = '2026-09-27'
where name = 'New Jersey Institute of Technology (NJIT)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'Applicants decide whether to send scores and are reviewed equally either way.',
  test_policy_change = 'WPI ended its test-blind pilot and returned to test-optional (faculty motion November 13, 2024).',
  test_policy_source_url = 'https://www.wpi.edu/admissions/undergraduate/apply/how-to/test-optional-admissions',
  test_policy_checked_date = '2026-09-27',
  sat_context = ''
where name = 'Worcester Polytechnic Institute (WPI)';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Through Fall 2029 entry',
  test_policy_detail = 'Scores are optional for engineering applicants; only the accelerated pre-medicine and pre-law programs require them.',
  test_policy_change = 'Extended through Fall 2029 entry.',
  test_policy_source_url = 'https://www.stevens.edu/admission-aid/undergraduate-admissions/first-year-students',
  test_policy_checked_date = '2026-09-27'
where name = 'Stevens Institute of Technology';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'No term stated',
  test_policy_term = 'No term stated',
  test_policy_detail = 'SAT and ACT scores are not required; applicants can self-report scores if they want them considered.',
  test_policy_change = NULL,
  test_policy_source_url = 'https://www.rose-hulman.edu/admissions-and-aid/the-application-process/application-and-deadlines/application-evaluation-criteria.html',
  test_policy_checked_date = '2026-09-27'
where name = 'Rose-Hulman Institute of Technology';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Permanent',
  test_policy_detail = 'SAT and ACT scores are not required; Vassar superscores the scores it receives.',
  test_policy_change = 'Made permanent on April 13, 2023.',
  test_policy_source_url = 'https://www.vassar.edu/news/vassar-makes-test-optional-policy-permanent-applicants',
  test_policy_checked_date = '2026-09-27'
where name = 'Vassar College';

update college.schools set
  test_policy = 'Optional',
  test_policy_fall2028_status = 'Covers Fall 2028',
  test_policy_term = 'Through Fall 2028 entry',
  test_policy_detail = 'Scores are optional for first-year applicants, including engineering; applicants without scores submit a personal statement or the Common App essay.',
  test_policy_change = 'Extended to cover Fall 2025 through Fall 2028 entry.',
  test_policy_source_url = 'https://admissions.pitt.edu/test-optional/',
  test_policy_checked_date = '2026-09-27'
where name = 'University of Pittsburgh';

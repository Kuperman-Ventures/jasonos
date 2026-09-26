# College List Update - In-State And Out-Of-State Admission Data

Prepared September 26, 2026. Source list: Kyle_Engineering_College_List_Simplified.xlsx (43 schools: 29 public, 14 private). Kyle is a New Jersey resident applying for Fall 2028 entry, so Rutgers and NJIT are in-state for him and the other 27 public schools are out-of-state.

Every figure comes from an official university or state source: a school's Common Data Set, admissions profile, institutional research report, or state higher-education data. No figures come from consultant, test-prep or ranking sites.

## Instructions For Cursor

1. Find where the app stores school records. Match records to this file by the exact school name in the `school` field.
2. Add these fields to every school record, using the values in the Import Data section:
   - `control`: `Public` or `Private`
   - `residencyDataStatus`: `Official`, `Estimated`, `Proxy`, or `Not applicable`
   - `kyleResidency`: `In-state`, `Out-of-state`, or `Not applicable`
   - `inStateAdmitRate`, `outOfStateAdmitRate`, `overallAdmitRate`: percentages as numbers (e.g. `28.0`), or `null`
   - `rateThatAppliesToKyle`: the in-state rate for Rutgers and NJIT, the out-of-state rate for the other public schools, `null` otherwise
   - `admitDataYear`: the entering class the admit rates describe (e.g. `Fall 2025`)
   - `enrolledOutOfStatePct`: share of enrolled first-years who are US out-of-state students, as a number, or `null`
   - `outOfStateDefinition`: whether the out-of-state figures include international applicants
   - `outOfStatePolicy`: any state or university limit on out-of-state enrollment, one sentence
   - `engineeringResidencyNote`: engineering-specific admit data where the school publishes any, otherwise `null`
   - `residencySourceUrl` and `residencyNotes`
3. On each public school, show `rateThatAppliesToKyle` next to the overall admit rate, labeled "Kyle's rate (in-state)" or "Kyle's rate (out-of-state)". Show `admitDataYear` beside it.
4. Show a small status label when `residencyDataStatus` is `Estimated` or `Proxy`, so those values are not read as official admit rates.
5. For private schools, show "Residency does not affect admission" instead of empty rate fields.
6. Do not change any other field.
7. After the update, confirm the counts match the Summary section below.

## Value Definitions

- **Official** - the school or state publishes in-state and out-of-state first-year admit rates, or the applicant and admit counts by residency that the rates were computed from.
- **Estimated** - only the in-state rate is published; the out-of-state rate was calculated from other published totals (Clemson only).
- **Proxy** - no admit rates by residency are published; only the overall admit rate and the out-of-state share of the enrolled class are available.
- **Not applicable** - private school; state residency does not affect admission.
- **Admit rate** - first-time, first-year applicants admitted divided by applicants, university-wide. These are not engineering-specific rates unless stated in `engineeringResidencyNote`.

## Summary

- Residency data status: 26 Official, 1 Estimated, 2 Proxy, 14 Not applicable (43 schools).
- Admit data year for the 29 public schools: Fall 2023 (1), Fall 2024 (3), Fall 2025 (24), Fall 2026 (1).
- Engineering-specific residency admit rates: found only for the University of Washington (3-year averages). None were found for the other 28 public schools.

## Points Worth Knowing

- **Out-of-state rates well below in-state rates.** For these 10 public schools, Kyle's out-of-state rate is more than 10 points below the in-state rate: UT Austin 7.5% vs 35.9%; Georgia Tech 9.0% vs 28.0%; UVA 14.3% vs 24.8%; UIUC 29.0% vs 49.3%; Purdue 43.6% vs 71.1%; Wisconsin-Madison 40.3% vs 56.4%; NC State 34.4% vs 46.2%; Texas A&M 41.3% vs 54.2%; Clemson (estimated) 40.3% vs 53.0%; Tennessee 35.1% vs 72.8%.
- **Out-of-state rates above in-state rates.** At UC Davis, UC Irvine, Minnesota, UConn, Virginia Tech, Maryland, Ohio State, Rutgers and UCLA, out-of-state applicants were admitted at a higher rate than in-state applicants. These are university-wide rates, and engineering admission can be more selective than the university as a whole - for example, UCLA admitted 6.8% of engineering applicants against 9.4% overall (Fall 2025).
- **Enrollment limits.** UT Austin (10% non-resident first-years by Texas law), NC State (18% by UNC System policy), UC campuses (Regents Policy 2109), and Colorado School of Mines (55% Colorado residents by state law) have formal limits on out-of-state enrollment.
- **Older data.** Rutgers (Fall 2023), NJIT (Fall 2024) and Delaware (Fall 2024) have not yet published newer residency figures. The newest overall admit rate for Colorado School of Mines is Fall 2024. Georgia Tech's figures are from Fall 2026, one year newer than most.
- **Kyle's in-state schools.** Rutgers-New Brunswick admitted 62.3% of New Jersey applicants (Fall 2023); NJIT admitted 68.7% (Fall 2024).
- **International applicants.** Maryland, Virginia Tech, Clemson and Colorado School of Mines report out-of-state figures that include or may include international applicants; see `outOfStateDefinition` for each school.

## Data Table (29 Public Schools)

Private schools are listed in the Import Data section with `residencyDataStatus` set to `Not applicable`.

| School | Status | Kyle Is | In-State Admit | Out-Of-State Admit | Overall Admit | Year | Enrolled Out-Of-State | Out-Of-State Limit |
|---|---|---|---|---|---|---|---|---|
| University of California, Berkeley (UC Berkeley) | Official | Out-of-state | 13.6% | 10.3% | 11.3% | Fall 2025 | 13.8% | UC Regents Policy 2109 holds Berkeley at or below its 2017-18 nonresident share, with a state target of 18% nonresidents. |
| Georgia Institute of Technology (Georgia Tech) | Official | Out-of-state | 28.0% | 9.0% | 12.8% | Fall 2026 | 33.0% | No cap found. |
| University of Michigan–Ann Arbor | Proxy | Out-of-state | - | - | 16.4% | Fall 2025 | 45.0% | No cap found. |
| University of Illinois Urbana-Champaign (UIUC) | Official | Out-of-state | 49.3% | 29.0% | 36.6% | Fall 2025 | 13.1% | No cap found. |
| University of Texas at Austin (UT Austin) | Official | Out-of-state | 35.9% | 7.5% | 22.2% | Fall 2025 | 7.7% | Texas law (Education Code 51.803(j)) limits non-resident first-years at UT Austin to 10% of the class. |
| University of California, Los Angeles (UCLA) | Official | Out-of-state | 9.6% | 11.2% | 9.4% | Fall 2025 | 15.5% | UC Regents Policy 2109 holds UCLA at or below its 2017-18 nonresident share, with a state target of 18% nonresidents. |
| Purdue University | Official | Out-of-state | 71.1% | 43.6% | 43.4% | Fall 2025 | 52.9% | No cap; Indiana seniors who earn the state's Enrollment Honors Plus Seal are guaranteed admission (not a guaranteed major). |
| University of Maryland, College Park | Official | Out-of-state | 43.7% | 45.5% | 45.0% | Fall 2025 | 35.2% | No cap found; the University System of Maryland policy site could not be checked. |
| University of Washington | Official | Out-of-state | 45.7% | 42.2% | 41.7% | Fall 2025 | 25.9% | No enacted cap found. |
| University of Wisconsin–Madison | Official | Out-of-state | 56.4% | 40.3% | 40.8% | Fall 2025 | 49.1% | No out-of-state cap; the UW System requires Madison to enroll at least 3,600 Wisconsin first-years each year. |
| Virginia Polytechnic Institute and State University (Virginia Tech) | Official | Out-of-state | 48.1% | 62.8% | 57.2% | Fall 2025 | 38.6% | No cap found. |
| Pennsylvania State University (Penn State) | Official | Out-of-state | 56.7% | 53.3% | 55.3% | Fall 2025 | 44.6% | No cap found. |
| Ohio State University | Official | Out-of-state | 45.1% | 46.4% | 49.2% | Fall 2025 | 27.3% | No cap found. |
| University of Minnesota Twin Cities | Official | Out-of-state | 63.6% | 85.3% | 78.9% | Fall 2025 | 27.0% | No cap found; a 2016 enrollment plan targeted about 65% Minnesota residents in the first-year class. |
| North Carolina State University (NC State) | Official | Out-of-state | 46.2% | 34.4% | 39.5% | Fall 2025 | 12.9% | University of North Carolina System Policy 700.1.3 caps out-of-state first-years at 18% of the class. |
| University of California, Davis (UC Davis) | Official | Out-of-state | 37.2% | 63.2% | 44.3% | Fall 2025 | 5.8% | UC Regents Policy 2109 requires California residents to be at least 82% of UC Davis undergraduates. |
| University of California, Irvine (UC Irvine) | Official | Out-of-state | 21.9% | 47.4% | 28.7% | Fall 2025 | 7.1% | UC Regents Policy 2109 requires California residents to be at least 82% of UC Irvine undergraduates. |
| Rutgers University–New Brunswick | Official | In-state | 62.3% | 72.0% | 65.3% | Fall 2023 | 8.7% | No cap found. |
| University of Florida | Official | Out-of-state | 22.3% | 20.5% | 20.3% | Fall 2025 | 21.1% | Florida Board of Governors Regulation 7.006 limits non-residents to 10% of undergraduates across the state university system; it sets no separate cap for UF. |
| Texas A&M University | Official | Out-of-state | 54.2% | 41.3% | 51.7% | Fall 2025 | 5.1% | No cap found. |
| Colorado School of Mines | Proxy | Out-of-state | - | - | 61.0% | Fall 2024 | 51.8% | Colorado law (C.R.S. 23-1-113.5) requires at least 55% of each incoming freshman class at state institutions to be Colorado residents, on a three-year rolling average. |
| University of Virginia (UVA) | Official | Out-of-state | 24.8% | 14.3% | 15.6% | Fall 2025 | 33.0% | UVA targets about two-thirds Virginians in each entering class. |
| University of Connecticut (UConn) | Official | Out-of-state | 40.5% | 58.5% | 54.4% | Fall 2025 | 44.6% | No cap found. |
| University of Delaware | Official | Out-of-state | 70.7% | 70.0% | 69.2% | Fall 2024 | 64.7% | No cap found. |
| Iowa State University | Official | Out-of-state | 92.1% | 91.1% | 87.9% | Fall 2025 | 46.1% | No cap found. |
| Clemson University | Estimated | Out-of-state | 53.0% | 40.3% | 42.4% | Fall 2025 | 47.6% | No cap found; Clemson reports that 91% of South Carolina applicants since 2021 were offered some path to enroll. |
| University of Tennessee, Knoxville | Official | Out-of-state | 72.8% | 35.1% | 43.6% | Fall 2025 | 39.0% | No cap; Tennessee students in the top 10% of their class or with a 4.0 core GPA are guaranteed admission. |
| Michigan Technological University (Michigan Tech) | Official | Out-of-state | 86.2% | 81.6% | 85.5% | Fall 2025 | 23.9% | No cap found. |
| New Jersey Institute of Technology (NJIT) | Official | In-state | 68.7% | 64.3% | 65.1% | Fall 2024 | 6.8% | No cap found. |

## Notes By School

- **University of California, Berkeley (UC Berkeley):** Computed from UC Information Center counts: 3,117 admits / 30,172 domestic nonresident applicants.
- **Georgia Institute of Technology (Georgia Tech):** Georgia Tech publishes the 28% and 9% rates directly. The enrolled out-of-state share is from the Fall 2025 class profile (33% out-of-state plus 8% international).
- **University of Michigan–Ann Arbor:** Michigan does not publish admit rates by residency and leaves that table blank in its Common Data Set; only the out-of-state share of the enrolled class is available.
- **University of Illinois Urbana-Champaign (UIUC):** From the UIUC Fall 2025 admissions report: 9,495 admits / 32,702 domestic non-resident applicants. Engineering: Grainger College of Engineering first-choice admit rate was 21.1% (all residencies combined); UIUC does not publish it by residency.
- **University of Texas at Austin (UT Austin):** Computed from the Common Data Set 2025-26: 2,653 admits / 35,268 domestic out-of-state applicants.
- **University of California, Los Angeles (UCLA):** Computed from UC Information Center counts: 3,544 admits / 31,573 domestic nonresident applicants. Engineering: UCLA publishes Samueli School of Engineering admit rates by major but not by residency: 6.8% for engineering overall, 4.7% for Aerospace and 3.9% for Mechanical (Fall 2025).
- **Purdue University:** Computed from the Common Data Set 2025-26: 25,650 admits / 58,853 domestic out-of-state applicants. Purdue's own press release gives 39% out-of-state because it includes international applicants.
- **University of Maryland, College Park:** Computed from the Common Data Set 2025-26: 22,143 admits / 48,614 out-of-state applicants.
- **University of Washington:** Computed from the Seattle Common Data Set 2025-26: 18,813 admits / 44,619 out-of-state applicants. Engineering: UW publishes 3-year average admit rates for direct-to-college Engineering: 43% for Washington residents and 37% for non-residents (non-resident figure includes international).
- **University of Wisconsin–Madison:** Computed from the Common Data Set 2025-26: 19,948 admits / 49,463 out-of-state applicants. Out-of-state counts include Minnesota reciprocity students.
- **Virginia Polytechnic Institute and State University (Virginia Tech):** Computed from Virginia state (SCHEV) counts: 22,586 admits / 35,964 out-of-state applicants. These are university-wide rates; engineering is more selective.
- **Pennsylvania State University (Penn State):** University Park campus only. Computed from the Common Data Set 2025-26: 38,846 admits / 72,861 domestic out-of-state applicants.
- **Ohio State University:** Columbus campus only. Computed from the Common Data Set 2025-26: 19,914 admits / 42,898 domestic out-of-state applicants.
- **University of Minnesota Twin Cities:** Computed from the Common Data Set 2025-26: 22,386 admits / 26,246 out-of-state applicants. Out-of-state counts include Wisconsin and Dakotas reciprocity students.
- **North Carolina State University (NC State):** NC State's Common Data Set prints the out-of-state and international columns in reverse; these figures (7,508 admits / 21,852 applicants) assume the swap, which is the only reading consistent with NC State's published 12% out-of-state share.
- **University of California, Davis (UC Davis):** Computed from UC Information Center counts: 8,332 admits / 13,185 domestic nonresident applicants. These are university-wide rates; engineering majors are more selective.
- **University of California, Irvine (UC Irvine):** Computed from UC Information Center counts: 7,764 admits / 16,386 domestic nonresident applicants. These are university-wide rates; engineering majors are more selective.
- **Rutgers University–New Brunswick:** Kyle applies as in-state. Fall 2023 is the newest New Brunswick residency data Rutgers has published. Computed: 18,053 in-state admits / 28,992 in-state applicants.
- **University of Florida:** Computed from the Common Data Set 2025-26: 8,086 admits / 39,420 domestic out-of-state applicants.
- **Texas A&M University:** Computed from the Common Data Set 2025-26: 4,489 admits / 10,882 domestic out-of-state applicants.
- **Colorado School of Mines:** Mines does not publish admit rates by residency. The overall rate is from federal College Navigator data (Fall 2024); the non-resident share is from the Fall 2026 census.
- **University of Virginia (UVA):** Computed from Virginia state (SCHEV) counts: 6,068 admits / 42,560 out-of-state applicants. The overall rate is UVA's own published figure.
- **University of Connecticut (UConn):** Storrs campus only. Computed from the Common Data Set 2025-26: 22,349 admits / 38,178 out-of-state applicants. The in-state rate may be lower partly because some Connecticut applicants are offered regional campuses instead of Storrs.
- **University of Delaware:** Computed from the Common Data Set 2024-25: 23,364 admits / 33,360 out-of-state applicants.
- **Iowa State University:** Computed from the Common Data Set 2025-26: 14,133 admits / 15,521 domestic out-of-state applicants.
- **Clemson University:** Clemson publishes only the in-state rate (53%). The out-of-state rate is estimated from the published in-state rate, total applicants and 10,714 South Carolina applicants; it should be confirmed against Clemson's Common Data Set 2025-26.
- **University of Tennessee, Knoxville:** Computed from the Common Data Set 2025-26: 14,526 admits / 41,408 out-of-state applicants.
- **Michigan Technological University (Michigan Tech):** Computed from the Common Data Set 2025-26: 2,798 admits / 3,428 domestic out-of-state applicants.
- **New Jersey Institute of Technology (NJIT):** Kyle applies as in-state. Computed from the Common Data Set 2024-25: 6,855 in-state admits / 9,984 in-state applicants. NJIT's Fall 2025 overall rate was 67.4%, with no residency split.

## Import Data (JSON)

All 43 schools, with source URLs. Use this for the import.

```json
[
  {
    "school": "Massachusetts Institute of Technology (MIT)",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Stanford University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "University of California, Berkeley (UC Berkeley)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 13.6,
    "outOfStateAdmitRate": 10.3,
    "rateThatAppliesToKyle": 10.3,
    "overallAdmitRate": 11.3,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 13.8,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "UC Regents Policy 2109 holds Berkeley at or below its 2017-18 nonresident share, with a state target of 18% nonresidents.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.universityofcalifornia.edu/about-uc/information-center/undergraduate-admissions-summary",
    "residencyNotes": "Computed from UC Information Center counts: 3,117 admits / 30,172 domestic nonresident applicants."
  },
  {
    "school": "Cornell University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Northwestern University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Carnegie Mellon University (CMU)",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "University of Pennsylvania (UPenn)",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Johns Hopkins University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Georgia Institute of Technology (Georgia Tech)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 28.0,
    "outOfStateAdmitRate": 9.0,
    "rateThatAppliesToKyle": 9.0,
    "overallAdmitRate": 12.8,
    "admitDataYear": "Fall 2026",
    "enrolledOutOfStatePct": 33.0,
    "outOfStateDefinition": "Not stated by the source",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://admission.gatech.edu/images/pdf/2026/2026-First-year-admitted-profile.pdf",
    "residencyNotes": "Georgia Tech publishes the 28% and 9% rates directly. The enrolled out-of-state share is from the Fall 2025 class profile (33% out-of-state plus 8% international)."
  },
  {
    "school": "University of Michigan–Ann Arbor",
    "control": "Public",
    "residencyDataStatus": "Proxy",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": 16.4,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 45.0,
    "outOfStateDefinition": "Not applicable - no residency admit rates published",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://obp.umich.edu/wp-content/uploads/pubdata/factsfigures/firstyearsprofile_umaa_2025.pdf",
    "residencyNotes": "Michigan does not publish admit rates by residency and leaves that table blank in its Common Data Set; only the out-of-state share of the enrolled class is available."
  },
  {
    "school": "University of Illinois Urbana-Champaign (UIUC)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 49.3,
    "outOfStateAdmitRate": 29.0,
    "rateThatAppliesToKyle": 29.0,
    "overallAdmitRate": 36.6,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 13.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": "Grainger College of Engineering first-choice admit rate was 21.1% (all residencies combined); UIUC does not publish it by residency.",
    "residencySourceUrl": "https://enrollmentmanagement.illinois.edu/wp-content/uploads/2025/09/10thDay-FirstYear-Fall-2025-250919.pdf",
    "residencyNotes": "From the UIUC Fall 2025 admissions report: 9,495 admits / 32,702 domestic non-resident applicants."
  },
  {
    "school": "University of Texas at Austin (UT Austin)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 35.9,
    "outOfStateAdmitRate": 7.5,
    "rateThatAppliesToKyle": 7.5,
    "overallAdmitRate": 22.2,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 7.7,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "Texas law (Education Code 51.803(j)) limits non-resident first-years at UT Austin to 10% of the class.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://reports.utexas.edu/common-data-set/pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 2,653 admits / 35,268 domestic out-of-state applicants."
  },
  {
    "school": "University of California, Los Angeles (UCLA)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 9.6,
    "outOfStateAdmitRate": 11.2,
    "rateThatAppliesToKyle": 11.2,
    "overallAdmitRate": 9.4,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 15.5,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "UC Regents Policy 2109 holds UCLA at or below its 2017-18 nonresident share, with a state target of 18% nonresidents.",
    "engineeringResidencyNote": "UCLA publishes Samueli School of Engineering admit rates by major but not by residency: 6.8% for engineering overall, 4.7% for Aerospace and 3.9% for Mechanical (Fall 2025).",
    "residencySourceUrl": "https://www.universityofcalifornia.edu/about-uc/information-center/undergraduate-admissions-summary",
    "residencyNotes": "Computed from UC Information Center counts: 3,544 admits / 31,573 domestic nonresident applicants."
  },
  {
    "school": "Purdue University",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 71.1,
    "outOfStateAdmitRate": 43.6,
    "rateThatAppliesToKyle": 43.6,
    "overallAdmitRate": 43.4,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 52.9,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap; Indiana seniors who earn the state's Enrollment Honors Plus Seal are guaranteed admission (not a guaranteed major).",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.purdue.edu/idata/wp-content/uploads/2026/04/CDS-2025-2026.xlsx",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 25,650 admits / 58,853 domestic out-of-state applicants. Purdue's own press release gives 39% out-of-state because it includes international applicants."
  },
  {
    "school": "University of Maryland, College Park",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 43.7,
    "outOfStateAdmitRate": 45.5,
    "rateThatAppliesToKyle": 45.5,
    "overallAdmitRate": 45.0,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 35.2,
    "outOfStateDefinition": "Includes international; UMD left the international column blank",
    "outOfStatePolicy": "No cap found; the University System of Maryland policy site could not be checked.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://irpa.umd.edu/InstitutionalData/CommonDataSet/CDS_2025-2026.xlsx",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 22,143 admits / 48,614 out-of-state applicants."
  },
  {
    "school": "University of Washington",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 45.7,
    "outOfStateAdmitRate": 42.2,
    "rateThatAppliesToKyle": 42.2,
    "overallAdmitRate": 41.7,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 25.9,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No enacted cap found.",
    "engineeringResidencyNote": "UW publishes 3-year average admit rates for direct-to-college Engineering: 43% for Washington residents and 37% for non-residents (non-resident figure includes international).",
    "residencySourceUrl": "https://cdn.uw.edu/wp-content/uploads/sites/162/2026/02/27111247/CDS_2025-2026_Seattle.pdf",
    "residencyNotes": "Computed from the Seattle Common Data Set 2025-26: 18,813 admits / 44,619 out-of-state applicants."
  },
  {
    "school": "University of Wisconsin–Madison",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 56.4,
    "outOfStateAdmitRate": 40.3,
    "rateThatAppliesToKyle": 40.3,
    "overallAdmitRate": 40.8,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 49.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No out-of-state cap; the UW System requires Madison to enroll at least 3,600 Wisconsin first-years each year.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://data.wisc.edu/common-data-set-and-rankings/",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 19,948 admits / 49,463 out-of-state applicants. Out-of-state counts include Minnesota reciprocity students."
  },
  {
    "school": "Virginia Polytechnic Institute and State University (Virginia Tech)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 48.1,
    "outOfStateAdmitRate": 62.8,
    "rateThatAppliesToKyle": 62.8,
    "overallAdmitRate": 57.2,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 38.6,
    "outOfStateDefinition": "Likely includes international; the state source does not report international separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://research.schev.edu/enrollment/rdPage.aspx?rdReport=Enrollment.B8H_Admissions_Report&lbUNITID=233921&lbSTUGROUP=FTF",
    "residencyNotes": "Computed from Virginia state (SCHEV) counts: 22,586 admits / 35,964 out-of-state applicants. These are university-wide rates; engineering is more selective."
  },
  {
    "school": "Pennsylvania State University (Penn State)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 56.7,
    "outOfStateAdmitRate": 53.3,
    "rateThatAppliesToKyle": 53.3,
    "overallAdmitRate": 55.3,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 44.6,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://opair.psu.edu/files/2026/09/CDS_2025_2026_UniversityPark_v3.pdf",
    "residencyNotes": "University Park campus only. Computed from the Common Data Set 2025-26: 38,846 admits / 72,861 domestic out-of-state applicants."
  },
  {
    "school": "Ohio State University",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 45.1,
    "outOfStateAdmitRate": 46.4,
    "rateThatAppliesToKyle": 46.4,
    "overallAdmitRate": 49.2,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 27.3,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://irp.osu.edu/sites/default/files/documents/2026/03/CDS-2025-2026-OSU-Columbus-Campus.pdf",
    "residencyNotes": "Columbus campus only. Computed from the Common Data Set 2025-26: 19,914 admits / 42,898 domestic out-of-state applicants."
  },
  {
    "school": "University of Minnesota Twin Cities",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 63.6,
    "outOfStateAdmitRate": 85.3,
    "rateThatAppliesToKyle": 85.3,
    "overallAdmitRate": 78.9,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 27.0,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found; a 2016 enrollment plan targeted about 65% Minnesota residents in the first-year class.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://idr.umn.edu/sites/idr.umn.edu/files/cds_2025_2026_tc.pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 22,386 admits / 26,246 out-of-state applicants. Out-of-state counts include Wisconsin and Dakotas reciprocity students."
  },
  {
    "school": "North Carolina State University (NC State)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 46.2,
    "outOfStateAdmitRate": 34.4,
    "rateThatAppliesToKyle": 34.4,
    "overallAdmitRate": 39.5,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 12.9,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "University of North Carolina System Policy 700.1.3 caps out-of-state first-years at 18% of the class.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://report.isa.ncsu.edu/ir/cds/pdfs/CDS_2025-26.v1.pdf",
    "residencyNotes": "NC State's Common Data Set prints the out-of-state and international columns in reverse; these figures (7,508 admits / 21,852 applicants) assume the swap, which is the only reading consistent with NC State's published 12% out-of-state share."
  },
  {
    "school": "University of California, Davis (UC Davis)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 37.2,
    "outOfStateAdmitRate": 63.2,
    "rateThatAppliesToKyle": 63.2,
    "overallAdmitRate": 44.3,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 5.8,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "UC Regents Policy 2109 requires California residents to be at least 82% of UC Davis undergraduates.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.universityofcalifornia.edu/about-uc/information-center/undergraduate-admissions-summary",
    "residencyNotes": "Computed from UC Information Center counts: 8,332 admits / 13,185 domestic nonresident applicants. These are university-wide rates; engineering majors are more selective."
  },
  {
    "school": "University of California, Irvine (UC Irvine)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 21.9,
    "outOfStateAdmitRate": 47.4,
    "rateThatAppliesToKyle": 47.4,
    "overallAdmitRate": 28.7,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 7.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "UC Regents Policy 2109 requires California residents to be at least 82% of UC Irvine undergraduates.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.universityofcalifornia.edu/about-uc/information-center/undergraduate-admissions-summary",
    "residencyNotes": "Computed from UC Information Center counts: 7,764 admits / 16,386 domestic nonresident applicants. These are university-wide rates; engineering majors are more selective."
  },
  {
    "school": "Case Western Reserve University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Rensselaer Polytechnic Institute (RPI)",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Rutgers University–New Brunswick",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "In-state",
    "inStateAdmitRate": 62.3,
    "outOfStateAdmitRate": 72.0,
    "rateThatAppliesToKyle": 62.3,
    "overallAdmitRate": 65.3,
    "admitDataYear": "Fall 2023",
    "enrolledOutOfStatePct": 8.7,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://oirap.rutgers.edu/CDS/2023/New%20Brunswick%20CDS_2023-2024_final_V1.pdf",
    "residencyNotes": "Kyle applies as in-state. Fall 2023 is the newest New Brunswick residency data Rutgers has published. Computed: 18,053 in-state admits / 28,992 in-state applicants."
  },
  {
    "school": "University of Florida",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 22.3,
    "outOfStateAdmitRate": 20.5,
    "rateThatAppliesToKyle": 20.5,
    "overallAdmitRate": 20.3,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 21.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "Florida Board of Governors Regulation 7.006 limits non-residents to 10% of undergraduates across the state university system; it sets no separate cap for UF.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://data-apps.ir.aa.ufl.edu/public/cds/CDS%202025-26_v8_08.14.2026.pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 8,086 admits / 39,420 domestic out-of-state applicants."
  },
  {
    "school": "Texas A&M University",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 54.2,
    "outOfStateAdmitRate": 41.3,
    "rateThatAppliesToKyle": 41.3,
    "overallAdmitRate": 51.7,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 5.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://abpa.tamu.edu/_files/_documents/common-data/cds-pdf-2025-2026.pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 4,489 admits / 10,882 domestic out-of-state applicants."
  },
  {
    "school": "Colorado School of Mines",
    "control": "Public",
    "residencyDataStatus": "Proxy",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": 61.0,
    "admitDataYear": "Fall 2024",
    "enrolledOutOfStatePct": 51.8,
    "outOfStateDefinition": "Likely includes international",
    "outOfStatePolicy": "Colorado law (C.R.S. 23-1-113.5) requires at least 55% of each incoming freshman class at state institutions to be Colorado residents, on a three-year rolling average.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://ir.mines.edu/data-visualizations/student-profiles/",
    "residencyNotes": "Mines does not publish admit rates by residency. The overall rate is from federal College Navigator data (Fall 2024); the non-resident share is from the Fall 2026 census."
  },
  {
    "school": "University of Virginia (UVA)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 24.8,
    "outOfStateAdmitRate": 14.3,
    "rateThatAppliesToKyle": 14.3,
    "overallAdmitRate": 15.6,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 33.0,
    "outOfStateDefinition": "Not stated by the source",
    "outOfStatePolicy": "UVA targets about two-thirds Virginians in each entering class.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://research.schev.edu/enrollment/rdPage.aspx?rdReport=Enrollment.B8H_Admissions_Report&lbUNITID=234076&lbSTUGROUP=FTF",
    "residencyNotes": "Computed from Virginia state (SCHEV) counts: 6,068 admits / 42,560 out-of-state applicants. The overall rate is UVA's own published figure."
  },
  {
    "school": "Lehigh University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "University of Connecticut (UConn)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 40.5,
    "outOfStateAdmitRate": 58.5,
    "rateThatAppliesToKyle": 58.5,
    "overallAdmitRate": 54.4,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 44.6,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://bpir.media.uconn.edu/wp-content/uploads/sites/3452/2026/08/UConn_CDS_2025_2026_WEB.pdf",
    "residencyNotes": "Storrs campus only. Computed from the Common Data Set 2025-26: 22,349 admits / 38,178 out-of-state applicants. The in-state rate may be lower partly because some Connecticut applicants are offered regional campuses instead of Storrs."
  },
  {
    "school": "University of Delaware",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 70.7,
    "outOfStateAdmitRate": 70.0,
    "rateThatAppliesToKyle": 70.0,
    "overallAdmitRate": 69.2,
    "admitDataYear": "Fall 2024",
    "enrolledOutOfStatePct": 64.7,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://ire.udel.edu/files/2025/07/CDS2425_UDelaware.pdf",
    "residencyNotes": "Computed from the Common Data Set 2024-25: 23,364 admits / 33,360 out-of-state applicants."
  },
  {
    "school": "Drexel University",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Iowa State University",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 92.1,
    "outOfStateAdmitRate": 91.1,
    "rateThatAppliesToKyle": 91.1,
    "overallAdmitRate": 87.9,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 46.1,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.ir.iastate.edu/files/documents/cds/CDS-25-26.pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 14,133 admits / 15,521 domestic out-of-state applicants."
  },
  {
    "school": "Clemson University",
    "control": "Public",
    "residencyDataStatus": "Estimated",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 53.0,
    "outOfStateAdmitRate": 40.3,
    "rateThatAppliesToKyle": 40.3,
    "overallAdmitRate": 42.4,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 47.6,
    "outOfStateDefinition": "Includes international",
    "outOfStatePolicy": "No cap found; Clemson reports that 91% of South Carolina applicants since 2021 were offered some path to enroll.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.clemson.edu/admissions/undergraduate-admissions/discover/statistics.html",
    "residencyNotes": "Clemson publishes only the in-state rate (53%). The out-of-state rate is estimated from the published in-state rate, total applicants and 10,714 South Carolina applicants; it should be confirmed against Clemson's Common Data Set 2025-26."
  },
  {
    "school": "University of Tennessee, Knoxville",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 72.8,
    "outOfStateAdmitRate": 35.1,
    "rateThatAppliesToKyle": 35.1,
    "overallAdmitRate": 43.6,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 39.0,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap; Tennessee students in the top 10% of their class or with a 4.0 core GPA are guaranteed admission.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://irsa.utk.edu/wp-content/uploads/sites/5/2026/06/CDS_2025-26_C_.pdf",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 14,526 admits / 41,408 out-of-state applicants."
  },
  {
    "school": "Michigan Technological University (Michigan Tech)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "Out-of-state",
    "inStateAdmitRate": 86.2,
    "outOfStateAdmitRate": 81.6,
    "rateThatAppliesToKyle": 81.6,
    "overallAdmitRate": 85.5,
    "admitDataYear": "Fall 2025",
    "enrolledOutOfStatePct": 23.9,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.mtu.edu/institutional-research/cds/files/cds-2025-2026.xlsx",
    "residencyNotes": "Computed from the Common Data Set 2025-26: 2,798 admits / 3,428 domestic out-of-state applicants."
  },
  {
    "school": "New Jersey Institute of Technology (NJIT)",
    "control": "Public",
    "residencyDataStatus": "Official",
    "kyleResidency": "In-state",
    "inStateAdmitRate": 68.7,
    "outOfStateAdmitRate": 64.3,
    "rateThatAppliesToKyle": 68.7,
    "overallAdmitRate": 65.1,
    "admitDataYear": "Fall 2024",
    "enrolledOutOfStatePct": 6.8,
    "outOfStateDefinition": "US non-residents only; international reported separately",
    "outOfStatePolicy": "No cap found.",
    "engineeringResidencyNote": null,
    "residencySourceUrl": "https://www.njit.edu/oie/sites/njit.edu.oie/files/CDS_2024-2025_v12.xlsx",
    "residencyNotes": "Kyle applies as in-state. Computed from the Common Data Set 2024-25: 6,855 in-state admits / 9,984 in-state applicants. NJIT's Fall 2025 overall rate was 67.4%, with no residency split."
  },
  {
    "school": "Worcester Polytechnic Institute (WPI)",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Stevens Institute of Technology",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  },
  {
    "school": "Rose-Hulman Institute of Technology",
    "control": "Private",
    "residencyDataStatus": "Not applicable",
    "kyleResidency": "Not applicable",
    "inStateAdmitRate": null,
    "outOfStateAdmitRate": null,
    "rateThatAppliesToKyle": null,
    "overallAdmitRate": null,
    "admitDataYear": null,
    "enrolledOutOfStatePct": null,
    "outOfStateDefinition": null,
    "outOfStatePolicy": null,
    "engineeringResidencyNote": null,
    "residencySourceUrl": null,
    "residencyNotes": "Private university; admission does not depend on state residency."
  }
]
```

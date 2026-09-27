# Kyle College Portal — App Map

Factual UI inventory of the college app under `college/`.

Scoir overlay source: [`college/data/scoir-import-2026-09-27.json`](../college/data/scoir-import-2026-09-27.json) via [`college/lib/scoir.ts`](../college/lib/scoir.ts). Match by `unitId`, then exact school name.

---

## 1. Top-level pages / tabs

### Live navigation: LeftRail (`/?tab=…`)

Rendered by `Portal` → `LeftRail`. Brand: **Kyle's College Search** (Junior · Columbia High School).

| Group | UI label | Tab id | Route |
| --- | --- | --- | --- |
| Plan | Dashboard | `dashboard` | `/?tab=dashboard` |
| Plan | Project Management | `projects` | `/?tab=projects&pm=timeline` (default `pm`) |
| Plan | Notes | `notes` | `/?tab=notes` (+ optional `&note=`) |
| Plan | Log | `log` | `/?tab=log` |
| Schools | Colleges | `colleges` | `/` or `/?tab=colleges` (+ optional `&school=`) |
| Schools | Apps & Materials | `apps` | `/?tab=apps&am=activities` (default `am`) |
| Schools | Finances | `finances` | `/?tab=finances` (hidden when role/phase cannot view finances) |
| Schools | Ingest | `ingest` | `/?tab=ingest` |
| Reference | Consultants | `consultants` | `/?tab=consultants` |
| Reference | FAQ | `faq` | `/?tab=faq` |
| Reference | Testing | `testing` | `/?tab=testing` |

Account menu (not in nav groups):

| UI label | Tab id | Notes |
| --- | --- | --- |
| Admin | `admin` | Admin role (or display name Local) |
| Sign out | — | POST `/auth/signout` |

Slim-rail short labels: Dashboard, Projects, Notes, Log, Colleges, Apps, Finances, Ingest, Consultants, FAQ, Testing.

### Project Management subnav (`pm=`)

| UI label | Section id |
| --- | --- |
| Timeline | `timeline` (default) |
| To-dos | `todos` |
| Calendar | `calendar` |

### Apps & Materials subnav (`am=`)

| UI label | Section id |
| --- | --- |
| Activities | `activities` (default; `av=` for My Activities / Awards & Milestones / Application Prep) |
| App Questions | `questions` |
| Materials | `materials` (soon) |

### School deep link

Opening a school sets Colleges + modal: `/?school=<schoolId>`.

---

## 2. College list page (`Colleges`)

Page title: **College list**. Phase eyebrow: `Phase N of 3 · {season}`.

### List phases (stepper)

| UI label | Phase id | Window |
| --- | --- | --- |
| Exploration | `exploration` | Sep 2026 – Dec 2026 |
| Consideration | `consideration` | Jan 2027 – Jul 2027 |
| Applications | `applications` | Jul 2027 onward |

Dashboard panels: **List size & selectivity mix**, **List size**, **Selectivity mix**.

### Toolbar filters

| Control | UI labels / options |
| --- | --- |
| Search | placeholder **Search schools** |
| Selectivity | **All selectivity**; Not set; Extremely selective; Very selective; Competitive; Less competitive |
| Setting (multi) | Urban; Suburban; Small city; College town; Small town |
| Metro size (multi) | Major metro; Large metro; Mid-size metro; Small metro |
| School size (multi) | Small; Medium; Large; Very large |
| Interest | **All interest**; Not set; Top choice; High; Medium; Low |
| Travel | **Drive or fly**; Drive; Fly |
| Archived | checkbox **Archived** |

Other toolbar actions: **Columns**, **Download spreadsheet**, **Paste update**, **Add school**.

### Sort (`aria-label` Sort schools)

| UI label | Sort key |
| --- | --- |
| Sheet order | `list` |
| School name | `name` |
| Drive time | `drive` |
| Campus setting | `setting` |
| School size | `size` |
| From NJ | `newJerseyPct` |
| Selectivity | `selectivity` |
| Interest | `interest` |
| Application status | `status` |
| Next action | `action` |

### Columns picker (`LIST_COLUMNS`)

Hint: “Saved for your login on this phase.” Reset: **Reset to {phase} defaults**.

| UI label | Column id | Required | Default on |
| --- | --- | --- | --- |
| School | `school` | yes | always |
| Location | `location` | | Exploration |
| Setting | `setting` | | Exploration, Consideration, Applications |
| Size | `size` | | Exploration, Consideration, Applications |
| Travel | `travel` | | Exploration |
| Status | `status` | | Applications |
| Track & deadline | `track` | | Consideration, Applications |
| Selectivity | `selectivity` | | all phases |
| Test policy | `testPolicy` | | all phases |
| Interest | `interest` | | all phases |
| Visit | `visit` | | Exploration, Consideration |
| Next action | `action` | | all phases |
| Mechanical | `mechanical` | | off |
| Materials | `materials` | | off |
| Aerospace | `aerospace` | | off |
| From NJ | `newJerseyPct` | | **off by default** (all phases) |

**From NJ** cell: Scoir `undergradGeography.newJerseyPct` (formatted %).

No Scoir badge on list rows.

---

## 3. School detail modal tabs

| Order | UI label | Tab id | Component |
| --- | --- | --- | --- |
| 1 | Snapshot | `snapshot` | `SchoolSnapshotSummary` |
| 2 | Requirements | `requirements` | `SchoolRequirements` |
| 3 | Financials | `financials` | `SchoolFinancials` |
| 4 | Project Management | `projects` | `SchoolProjectManagement` |
| 5 | Photos | `photos` | `SchoolPhotos` |
| 6 | Trip planning | `visit` | `SchoolTripPlanning` |
| 7 | Settings | `settings` | inline in `CollegeRecord` |

Visit status/notes live under Project Management → Visit. Trip planning is the live planning surface.

Header chrome: prev/next school nav, school name, Visit {site} link, list-phase chip.

---

## 4. School detail — Snapshot

Intro: **School snapshot** / “Key facts at a glance.”

### Location

| UI label | Stored / source |
| --- | --- |
| (map + city line) | `location` — school row |
| Drive from home | `driveMinutes`, `driveMiles`, `travelMode` — school row / `data/drive-matrix.json` |
| Nearest schools on the list | computed from drive matrix vs live list |

### Selectivity

| UI | Source |
| --- | --- |
| Selectivity gauge | `selectivityTier` — school row |

### Admissions

| UI label | Stored field | Source |
| --- | --- | --- |
| (tier headline) | `selectivityTier` | school row |
| Test policy | `testPolicy` or editable `familyTestPolicy` | school row |
| Fall 2028 not announced (badge) | `testPolicyFall2028Status` | school row |
| Detail | `testPolicyDetail` | school row |
| Term covered | `testPolicyTerm` | school row |
| Recent change | `testPolicyChange` | school row |
| Source → Official policy page | `testPolicySourceUrl` | school row |
| Checked | `testPolicyCheckedDate` | school row |
| SAT | `satContext` | school row |
| Pathway | derived from `admissionsContext` | school row |
| Residency | (private message) | `control` / residency fields |
| Overall admit rate | `overallAdmitRate`, `admitDataYear` | school row |
| Kyle's rate (in-state / out-of-state) | `rateThatAppliesToKyle`, `kyleResidency` | school row |
| Engineering note | `engineeringResidencyNote` | school row |
| Out-of-state policy | `outOfStatePolicy` | school row |

### Project Management (snapshot area)

| UI label | Stored field | Source |
| --- | --- | --- |
| (status headline) | `applicationStatus` | school row |
| Interest | `interestLevel` | school row |
| Application status | `applicationStatus` | school row |
| Admission track | `admissionTrack` | school row |
| Next deadline | deadlines[].dueDate | school deadlines |

### Programs

| UI label | Stored field | Source |
| --- | --- | --- |
| Mechanical engineering / Material sciences / Aerospace engineering | offered fields + `trackedPrograms` | school row |
| Degree shape | `materialsOffering` | school row |
| Engineering share of bachelor's degrees | `engineeringShareOfDegreesPct` | Scoir |
| ＋ Track another program | `trackedPrograms` | school row |

### Campus

| UI label | Stored field | Source |
| --- | --- | --- |
| City | `location` | school row |
| Campus Setting | `campusSetting`, `metroArea`, `metroPopulation` | school row |
| School Size | `undergradEnrollment` | school row (Scorecard-seeded) |
| Site | `website` | school row |

### Student Body (after Campus; Scoir only; hidden if no Scoir match)

Heading: **Student Body** / “% of undergraduates”. Source line: “Source: Scoir, 2026-09-27”.

#### Where students come from

| UI label | Scoir field |
| --- | --- |
| {homeState} (home state) | `undergradGeography.homeState` / `homeStatePct` |
| New Jersey | `undergradGeography.newJerseyPct` |
| Other U.S. states | `otherUsStatesPct` |
| International | `internationalPct` |
| Other origins (incomplete) | when `complete` is false |
| States represented | `statesRepresented` |
| Top places | `topPlaces[]` |

#### Race and ethnicity

Asian, Black, Hispanic, White, American Indian, Two or more races, international, other and not reported → `undergradRaceEthnicityPct.*`

#### Gender

Female, Male → `undergradGenderPct`; Full time → `undergradFullTimePct`

#### Greek life

Chapters; Men who join; Women who join → `greekLife.*`

### Around campus

Satellite map (~7 mi radius); Open in Google Maps.

Foot note: tuition/aid live in Financials; missing Middle 50% / application platform / teacher recommendations called out when blank.

---

## 5. School detail — Requirements

Header stats:

| UI label | Source |
| --- | --- |
| To submit | derived from requirement profile |
| Platform | `applicationPlatform` — school row |
| Testing | test-scores state from school row |
| Recommendations | derived from `teacherRecs` |
| Application fee | Scoir `applicationFee` (“No fee” / money / —); sub “first-year” |

### Requirement profile

Group headings: **Required**, **Modified**, **Not required**, **Not listed**.

| UI label | Key | Primary source |
| --- | --- | --- |
| Application | `application` | school row (`applicationPlatform`) |
| Personal essay | `essay` | school row (`requiredEssays`); Scoir `essayOrStatement` only if still “Not in our data” (chip **Scoir**) |
| Supplemental essays | `supplements` | school row |
| Test scores | `tests` | school row (`testPolicy` / `familyTestPolicy`) |
| Teacher recs | `teacherRecs` | school row |
| Counselor rec | `counselorRec` | derived from `teacherRecs` |
| Interview | `interview` | default “Not in our data”; Scoir `interview` when gap (chip **Scoir**) |

### Kit table

Columns: **Status**, **To submit**, **{school} says**, Add to To-Do.

### Context

| UI label | Source |
| --- | --- |
| Where Kyle's SAT lands | middle-50 from school row; marker label **Kyle** |
| Middle 50%: … | `middle50` — school row |
| Admissions context | `admissionsContext` — school row |
| Honors college: separate application / by invitation | Scoir `honorsCollege` |
| Tracks demonstrated interest | Scoir `considersDemonstratedInterest` |

Foot: Test policy · Platform; link **Edit requirements**.

### Edit requirements fields

Test policy, Middle 50%, Application platform, Teacher recommendations, SAT context, Required essays, Admissions context — school-row fields.

---

## 6. School detail — Financials

Primary record: [`college/data/finances.json`](../college/data/finances.json) matched by exact school name. Household numbers: persisted state `finances`.

### Where it lands among the N schools on your list

Compare strips: Published cost; First-years getting merit; Average merit award; After typical merit; Cost of living · U.S. = 100.

### What {total} covers

Segments: Tuition and fees; Housing and food; Books; Other — from finances JSON.

### Scholarships and aid

Merit / need program rows from finances JSON. Facts: Meets full need; Need-blind; CSS Profile; NJ state aid; Priority aid deadline.

### Your numbers

| UI label | Stored | Source |
| --- | --- | --- |
| Net price estimate / yr | `household.schools[id].netPriceEstimate` | household state |
| Date run | `netPriceDate` | household state |
| Merit award offered / yr | `meritAwardOffered` | household state |
| Net Price Calculator ↗ | `netPriceCalculatorUrl` | finances JSON |

### Net Price By Family Income (below Your Numbers; Scoir)

| UI | Scoir field |
| --- | --- |
| Table Family income / Net price | `netPriceByIncome` rows: Under $30,000; $30,000-$48,000; $48,000-$75,000; $75,000-$110,000; Over $110,000; All aided students |
| (note) | `netPriceByIncomeNote` |
| Students receiving aid | `pctReceivingAid` |
| Students with federal loans | `pctFederalLoans` |
| Median debt at graduation | `medianDebtAtGraduation` |

Footer: finances notes + Cost source ↗.

---

## 7. School detail — Project Management

Heading: **Project Management**.

| UI label | Subtab id |
| --- | --- |
| Notes | `notes` |
| Contacts | `contacts` |
| Visit | `visit` |
| Touchpoints | `touch` |
| Deadlines | `deadlines` |

### Notes

New note composer; Send to: To-Do / Notes / Calendar; `{user}'s {school} Notes` → `projectNotes[]`.

### Contacts

Name, Role, Email, Phone → `contacts[]`. **Add contact**.

### Visit

| UI label | Stored field |
| --- | --- |
| Visit status | `visitStatus` |
| Visit date | `visitDate` |
| Visit notes | `visitNotes` |

### Touchpoints

Banner when Scoir `considersDemonstratedInterest`: “This school tracks demonstrated interest. Visits, info sessions and contact with admissions count toward the decision.”

Rows: `steps[]` (label + owner). Presets: Campus visit, Info session, Interview, Supplemental essay, Scores sent, Recommendations, Application submitted, Portal checked, Decision, Deposit.

### Deadlines

Done, Milestone, Due → `deadlines[]`. **Add deadline**.

---

## 8. School detail — Photos

Kicker: **Photos**.

### Our visit

Family uploads. Control: **Add photos**.

### From {short school name}

Catalog: [`college/data/school-photos.json`](../college/data/school-photos.json). Optional **Virtual tour ↗**.

---

## 9. School detail — Trip planning

Kicker: **Trip planning**.

| UI label | Subtab id |
| --- | --- |
| Nearby | `nearby` |
| When to go | `when` |
| Itinerary | `itinerary` |
| Climate | `climate` |
| All schools | `all` |

### Nearby

Map + list; **Getting there**; interest legend (**Kyle's interest** + This school). Drive matrix / geocode / travel points.

### When to go

Heading **When to go**; week picker; campus calendars from [`college/data/campus-calendars.json`](../college/data/campus-calendars.json); **Kyle** column.

### Itinerary

Trip title; send visits to Calendar / to-dos.

### Climate

Heading **Climate**; Compare with; **Calendar** block from campus-calendars JSON.

### All schools

Heading **All schools**; region map from `state-regions.json` + list schools.

---

## 10. School detail — Settings

Heading: **Settings**.

### List phase

Phase label / archived; Move back / Move to / Archive / Restore. Fields: `listPhase`, `phasesParticipated`, `archived`.

### School profile

Location, Campus setting, Metro area, Metro population, Website, Selectivity tier, Interest, Application status, Admission track, Mechanical Engineering, Material Sciences, Material sciences offering, Materials program, Aerospace Engineering, Aerospace program, Aerospace notes, Aerospace source, Materials source — school-row fields.

### Notes for Kyle

`notes` — school row.

### Where this came from

`researchSources` — school row.

Action: **Remove school**.

---

## Data sources

| Source | Path / system | Used for |
| --- | --- | --- |
| School DB row | `/api/schools` + state | Core school fields, PM, settings, list |
| Scoir import | `college/data/scoir-import-2026-09-27.json` | NJ %, Student Body, engineering share, app fee, essay/interview gaps, honors, DI, net price by income, aid % / debt |
| Finances JSON | `college/data/finances.json` | School Financials published costs/aid |
| Household finances | `/api/state` `finances` | Your Numbers |
| Drive matrix | `college/data/drive-matrix.json` | Travel, nearest schools, trip clustering |
| School photos | `college/data/school-photos.json` | Photos tab school images |
| Campus calendars | `college/data/campus-calendars.json` | Trip When / Climate calendar |
| College Scorecard | Scorecard API (add-school / seeded fields) | `undergradEnrollment`, `unitId`, some cost seeds |
| Common App | school-row text | `applicationPlatform`, `requiredEssays` feeding Requirements |

---

## Related top-level pages (brief)

Dashboard; Project Management (Timeline / To-dos / Calendar); Notes; Log; Apps & Materials; Finances (household + list); Ingest; Consultants; FAQ; Testing; Admin.

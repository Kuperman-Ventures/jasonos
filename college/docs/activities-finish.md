# Cursor Prompt - Finish Activities: Load Safety, Prep Fixes, Plan, Activity Detail, UC Application

Repo: `Kuperman-Ventures/jasonos`, production branch `cursor/kyle-college-portal-cb3a`, app folder `college/`.
Written against commit `4df0960` ("Fix Application Prep tab switch and stuck Saving in local mode") and the live site on Oct 3, 2026.

Reference mockup: `college/docs/plan-and-detail.html` (add the attached file to the repo before starting). The strip at the top switches between the Plan tab, the project planner, a saved project, and the activity detail page. Where this prompt and the mockup disagree, this prompt wins. Thread names, answers, the project and the partner in the mockup are placeholders.

This covers everything left in the Activities section of Apps & Materials. Materials and Writing are separate and not part of it.

Build in five parts. **Stop after each part**, run `npm test`, and report with screenshots at desktop width and 390px, light and dark. **Part A is urgent: ship it on its own first.**

Applies throughout:

- Plain second-person copy. Hyphens, not em dashes.
- Tokens from `app/tokens.css` only. `--font-serif` for headings.
- No `.stack-field` / `.label` form styling and no `.field` boxes on the new screens. Questions are the labels. Borderless inputs with a 2px bottom border, as on Recall and Application Prep.
- No `<select>` where there are seven or fewer choices. Use pills.
- Edit controls only when `canEdit` is true.
- **Nothing calls `onChange` until the journal has loaded** (see Part A).

---

## Part A - Never save before the journal loads (urgent)

### What happened

On Oct 3 at 10:35 pm, opening `/?tab=apps&am=activities&av=prep` directly wiped the activities journal in production. `PrepView` (`components/ActivitiesJournal.tsx`, line ~2068) runs an effect on mount that calls `onChange(ensureCommonAppList(journal))`. On a direct load or a refresh, it ran while `journal` was still the empty default, and the save replaced the real journal with an empty one plus the Common App list. The data has since been restored by hand.

### Fix

1. Pass the existing `loaded` flag from `ActivitiesJournal` into `PrepView`, as `MyActivitiesView` already receives it. While `!loaded`, `PrepView` renders the header only and runs no effects that save.
2. Run the `ensureCommonAppList` effect only when `loaded && canEdit`.
3. Search every component under `components/` for effects that call `onChange`, `onJournalChange`, `patchState` or `changeJournal` on mount or on a dependency change, and gate each one on `loaded` in the same way. List each one you changed in your report.
4. **Guard the save itself.** In `components/Portal.tsx`, `changeJournal` must refuse to save until the journal has finished loading from the server (the existing `loaded` state, line ~237). If it is called earlier, log a console warning and do not save.
5. **Guard the server.** In `app/api/state/route.ts`, reject a PATCH whose `activitiesJournal` has fewer activities than the stored journal **and** no `profile`, while the stored journal has a `profile`. Return 409 with the message "Refusing to replace a loaded journal with an empty one." This blocks this class of bug even if a client-side guard is missed. Archiving does not reduce the activity count; removing a Recall answer deletes one activity at a time while `profile` is present, so neither is blocked.
6. Tests:
   - `PrepView` does not call `onChange` while `loaded` is false.
   - `changeJournal` does not call `patchState` before load.
   - Unit test of the server guard's comparison as a pure function, `isDestructiveJournalWrite(stored, incoming): boolean`, in a new `lib/journal-guard.ts`.

**Stop here and report. Ship Part A before continuing.**

---

## Part B - Application Prep fixes

### B1. "Changed" shows for changes that do not affect the entry

`isDraftStale` compares `activity.updatedAt` with `draft.reviewedAt`. But `assignActivityToThread`, `deleteThread`, `renameThread` and any reflection or update edit also bump `updatedAt`, so moving an activity into a thread marks its ready Common App entry "Changed".

Replace it with a fingerprint of only the facts the Common App entry shows:

```ts
/** Stable string of the My Record facts shown on a Common App entry. */
export function draftSourceFingerprint(activity: Activity): string;
// JSON of: name, commonAppGrades, commonAppTiming, commonAppTime
```

- On "Mark as ready", store it in a new optional `ApplicationDraft.sourceFingerprint` (normalized).
- `isDraftStale(draft, activity)` = ready, and the stored fingerprint differs from the current one. A ready draft with no stored fingerprint (marked ready before this change) is not stale.
- Drop the unused `sourceUpdatedAtSnapshot` field from the UI. Keep it in the normalizer.

Tests: moving an activity into a thread does not make a ready draft stale; changing hours in a period does.

### B2. Archived or deleted activities on the Common App list

Today an archived activity stays on the list, counts toward 10, and is copied out.

- A draft whose activity is **archived**: show it at the bottom of "Your list" with the state tag "Archived", muted, with "Remove from list" and "Restore in My Record" links. It does not count toward 10, `prepSummary` or `commonAppCopyText`, and gets no position number.
- A draft whose activity **no longer exists**: drop it in `normalizeJournal`. Add a test.
- The same rules apply to honors whose award is archived.

### B3. Layout fixes seen on the live site

- The Activities / Honors pill toggle (`.prep-seg`) stretches the full width. Make it `display: inline-flex` so it is only as wide as its two buttons.
- "Copy all for the Common App" is enabled with nothing chosen. Disable it when there are no activities and no honors on the list, with the `title` "Choose activities or honors first".
- The empty state reads "Your list is empty because My Record is empty." even while the journal is loading. With Part A it renders only after load. Confirm it no longer appears when My Record has activities.

**Stop here and report.**

---

## Part C - Plan tab

Plan holds the next two years: questions per thread, and one self-started project. Planned steps become `planned` periods, which My Record already draws as hatched cells.

### C1. Tab

In `lib/apps-materials.ts`, add `{ id: "plan", label: "Plan" }` between My Record and Application Prep. Update `ActivitiesViewId`, tests and `docs/APP_MAP.md`. New file `components/PlanView.tsx`.

### C2. Data

`ActivityThread.plan` (`ThreadPlan`) already exists and is normalized. Add the project model from `college-list-activities-recall-threads-plan.md` Part 2, unchanged, to `lib/activities-journal.ts`:

```ts
export type PartnerStatus = "not_contacted" | "contacted" | "meeting_held" | "approved" | "declined";
export type ProjectPartner = { id: string; organization: string; contactName?: string; contactRole?: string; status: PartnerStatus; notes?: string };
export type ProjectMilestone = { id: string; label: string; targetMonth?: string; done: boolean; doneDate?: string };
export type SelfStartedProject = {
  need?: string;
  beneficiaries?: string;
  buildsOnActivityIds?: string[];
  partners: ProjectPartner[];
  deliverable?: string;
  milestones: ProjectMilestone[];
  evidencePlan?: string;
  afterGraduation?: string;
};
// on Activity:
project?: SelfStartedProject;
```

Normalize all of it (drop partners without `organization`, milestones without `label`; unknown statuses become `not_contacted`). Helpers, all tested: `isSelfStartedProject(a)`, `overdueMilestones(project, now)`, `plannedStepsForThread(journal, threadId)`.

A project is an `Activity` with category `independent-project-business`, so it appears in My Record and Application Prep like any activity. In My Record, its row shows the pill "Self-started project" after the name.

### C3. Header

`<h3>` in `--font-serif`: "Plan". Summary (16px, muted): "What you plan to do between now and graduation. Your threads come first, because sticking with things is what colleges notice most."

### C4. Your Threads

Section heading "Your Threads" (serif 24px, 2px `--color-text` rule), count on the right ("2 threads").

When there are no threads: "Group your activities into threads first." with a strong link "Go to My Record".

One block per thread, in the order My Record shows them. Only one thread is open at a time; the first is open by default. A closed thread shows its name (serif 20px), "N of 5 answered" and the strong link "Open this thread's questions".

An open thread shows:

1. Its name (serif 20px).
2. Its activities as grade rows, reusing the My Record grade header and `GradeStrip` `row` size, so planned periods show hatched.
3. The five questions as a list. One question is open at a time; the others are one-line rows showing the key, the question and "Answer" or "Answered". Clicking a row opens it.

   | Key | Label (mono, uppercase, `--text-accent`) | Question | Helper ("For example: ...") |
   |---|---|---|---|
   | `deeper` | Deeper | What skill level could you reach by the end of senior year? | Move up a chair or section, earn the next rank or level, make a higher team, pass the next certification. |
   | `lead` | Lead | What role could you take on, or who could you teach? | Section leader, captain, officer, mentoring newer members, running a practice or workshop. |
   | `outsideSchool` | Outside school | Where else does this happen beyond your school? | Regional or state competitions, community groups, summer programs, college or industry events. |
   | `makeSomething` | Make something | What could you build, record or show? | A recording, a design you can share, a written guide, a portfolio, a performance you organize. |
   | `connect` | Connect | Does this thread overlap with another one? | A skill from one thread used to solve a problem in another. |

   The open question is a raised card with a borderless textarea. It saves on blur through `onChange`, with "Saves as you type" as muted text on the card's top right. Do not suggest answers.
4. Under an answered question (canEdit): strong link "Add as a planned step". It opens an inline row:
   - Activity: pills of the thread's activities
   - Grade: pills from the next grade through 12th
   - When: School year / Summer / All year pills
   - The answer text, prefilled and editable
   - "Add step" (primary) and "Cancel"

   "Add step" calls `addPeriod` with `status: "planned"`, `schoolYear = schoolYearForGrade(classOf, grade)` and `responsibilities` = the text. The thread's grade rows update at once.
5. Under the questions, the thread's planned steps from `plannedStepsForThread`: a small hatched swatch, "**{activity}** · {grade}th grade · {text}", and a "Remove" link (`removePeriod`).

### C5. Self-Started Project

Section heading "Self-Started Project" (serif 24px). Intro (muted): "Something you organize and create yourself, from an idea to a finished result. It usually needs help or permission from someone outside your school. It sits alongside your long-term activities and does not replace them."

**No project yet:** primary button "Plan a project".

**Planner** (`components/SelfStartedProjectPlanner.tsx`): replaces the Plan page content, with "← Back to Plan" at top left. Same pattern as Recall: one question per screen in the main column, the project so far in a 280px right column (stacks under 780px).

- Counter "Question N of 9" (mono, muted). Question as a serif heading, 26px. Helper "For example: ..." under it.
- Footer: primary "Next question" (on the last: "Save project"), "Previous question" and "Skip for now" text links.
- Right column: mono label "Your project so far", then the nine labels as an ordered list. Answered items read "{label} - answered"; the current one is in `--text-accent` and bold.
- The project activity is created when question 1 is answered (`createActivity` with the name, category `independent-project-business`, `ongoing: true`, an empty `project`) and saved on every Next, so nothing is lost if the student leaves.

| # | Label | Question | Input | Helper |
|---|---|---|---|---|
| 1 | Name | What's a working title? | single line | A working title is fine. You can change it later. |
| 2 | Need | What problem or need are you addressing? | textarea | Something you noticed that isn't working, is missing, or could be better - at school, in your town, or for a group you belong to. |
| 3 | Who benefits | Who or what benefits? | textarea | A group of people, a place, an organization, or the environment. |
| 4 | Builds on | Which of your activities does it build on? | multi-select pills of non-archived, non-project activities | Projects that use skills from your long-term activities are easier to explain in your application. |
| 5 | Partners | Who has to say yes? | borderless input + Enter adds a partner card | A town office, a school department, a local nonprofit, a business. |
| 6 | Deliverable | What will you make or deliver? | textarea | The finished thing someone can see, use or visit. |
| 7 | Milestones | What are the steps, and when? | milestone list (below) | Steps that need someone else's approval usually take longer than you expect. |
| 8 | Evidence | How will you show it worked? | textarea | Photos, measurements or data, a letter from a partner, a news story, people who used it. |
| 9 | After you graduate | What happens after you graduate? | textarea | Who keeps it going, maintains it, or takes it over. |

- Question 4: when nothing is selected and other activities exist, show the muted line "Is there an activity this connects to?"
- Partner card (question 5): organization (600), "Contact: {name}, {role}" or "Contact: not added" with an inline "Add contact" link, and five status pills: Not contacted, Contacted, Meeting held, Approved, Declined. "Remove" link.
- Milestones (question 7): start with six rows: Research, Design, Get approval, Build or create, Launch or install, Follow up. Each row: label (editable inline), a month chip ("Target month" when empty) that opens `<input type="month">`, "Remove", and up/down links. "+ Add a step" at the end.

**Saved project** (after "Save project"): the section shows the project name as the heading, "Edit answers" (reopens the planner at question 1) and "Open in My Record" links, then:

- A muted line: "Builds on {activities}. Partner: {organization}, {status}." (one per partner)
- The milestone list: a checkbox, the label, and the month chip on the right. A past target month on an unfinished step shows the chip and the note "Past target month" in `--status-failing`.
- Checking a step sets `done` and `doneDate`, and shows a strong "Log a moment" link that opens the Moments form from Part D, prefilled with this activity and "Completed: {step}". Nothing is created automatically.
- Under the list (13px, muted): "Tap a month to change it. Checking a step off lets you log a moment about it."
- "Plan another project" below the last project. Most students will have one.

### Part C tests

Round-trip of `project`; partner and milestone normalizing; `overdueMilestones` (2026-09 overdue on 2026-10-03; 2026-10 not; done never overdue); `plannedStepsForThread`; adding a planned step creates a `planned` period with the right `schoolYear`.

**Stop here and report.**

---

## Part D - Activity detail as one page

`ActivityDetail` (`components/ActivitiesJournal.tsx`, line ~1335) has five tabs of form fields, and its periods list cannot be edited (no edit or remove, though `updatePeriod` and `removePeriod` exist in the lib). Replace it with a single scrolling page. Keep the `initialTab` prop working by scrolling to the matching section (`periods` → Each Year, `updates` → Moments, `reflections` → Why It Matters, `people` → People and Links).

**Header:** "← My Record" text link. The activity name as a serif `<h2>` (clamp 28-36px), with `ActivityIcon`. A muted line: the span sentence (`recordSpanText`) plus " · {thread name} thread" when it has one. On the right: "Rename" (inline edit) and "Archive" (inline confirm, as today).

**1. Each Year.** Heading "Each Year". Sub: "Hours and weeks feed your Common App entry. Fill in your best estimate."
A table inside an `overflow-x: auto` wrapper, one row per period, newest grade first:
- Grade ("11th", plus "now" in `--text-accent`, or "planned" for planned periods)
- When: School year / Summer / All year pills
- Hours per week and Weeks per year: small numeric borderless inputs. Empty ones on completed or in-progress periods get an accent underline, so the gap is visible.
- Your role that year: borderless input
- "Remove" link (`removePeriod`; for the last remaining period, confirm inline first)

All saving goes through `updatePeriod`. Below the table: "+ Add a year" (adds a period for the next grade back that has none, or opens grade pills when that is ambiguous) and "+ Plan a future year" (grade pills for grades after the current one, status `planned`). Remove `AddPeriodForm`.

**2. What You Do.** Questions as labels, borderless inputs:
- "What's your role?" (help: "Your title or position now, if you have one.") → `role`
- "Which group or organization?" → `organization`
- "What do you actually do?" (help: "A few sentences in your own words. You'll shorten it for the Common App later.") → `responsibilities`
- "What type of activity is it?": the three most likely category pills (the current category, plus School club and Arts/music/theater when they are not current), then a "More types" pill that opens a popover with all 14 `ACTIVITY_CATEGORIES`. No `<select>`.
- Keep `orgPurpose` as an optional fifth question: "What does the group do?"
- Remove the "Ongoing" checkbox. Keep the `ongoing` field, but set it automatically whenever periods change: true when there is an `in_progress` period in the current grade, otherwise false. Put the rule in a lib helper `ongoingFromPeriods(activity, currentGrade)`, call it from `addPeriod`, `updatePeriod` and `removePeriod` callers in the detail page, and test it.

**3. Why It Matters.** Sub: "These are notes for your essays. Nobody else sees them unless you share them." Four textareas mapped to `reflections`: "Why does this matter to you?" (`whyMatters`), "What have you gotten better at?" (`skills`), "How have you changed since you started?" (`growth`), "What's one moment you remember?" (`memorable`). Each saves on blur.

**4. Moments** (the UI name for updates). Sub: "Things that happened: a show, a competition, a new role, something you learned." A list, newest first: date (mono, 90px column) and `whatHappened`, with recognition and learned as muted lines. "+ Add a moment" opens an inline form restyled to the new pattern: date, "What happened?" (required), "Any recognition?" and "What did you learn?". Reuse the `addUpdate` logic. Delete the old `AddUpdateForm` styling, not the logic.

**5. Awards.** Awards linked to this activity, in the My Record awards row style. "+ Add an award" opens the award form with `activityId` preset.

**6. People and Links.** Mentor (name, role, email) and links, in the new input style. Empty text: "A coach, director or mentor who knows your work, and links to recordings or photos." with "+ Add a person" and "+ Add a link".

Remove the `.aj-tabs` tab bar and the five-tab state. Remove CSS used only by the old detail view.

### Part D tests

The ongoing-from-periods helper; `updatePeriod` and `removePeriod` through the new UI handlers (pure helpers if you extract any).

**Stop here and report.**

---

## Part E - UC Application entries

Four schools on Kyle's list use the UC Application (Berkeley, Davis, Irvine, UCLA). UC's own counselor guide (`admission.universityofcalifornia.edu`, "Presenting yourself on the first-year UC application 2026-27") confirms **up to 20 entries across 6 categories**: Award or honor, Educational preparation program, Extracurricular activity, Other coursework, Volunteering/community service, Work experience. UC's public pages do not publish the field character limits, so this part does not enforce any.

### E1. Data

```ts
export const UC_APP_LIST_ID = "uc-application";
export type UcCategory = "award" | "educational_prep" | "extracurricular" | "other_coursework" | "volunteer" | "work";
// on ApplicationDraft:
ucCategory?: UcCategory;
```

`ensureUcAppList` works like `ensureCommonAppList`, with the same Part A load guard. Normalize `ucCategory`.

### E2. Where it shows

In Application Prep, when any non-archived school on the college list has `application_platform` = "UC Application", the pill toggle gets a third option: "UC Application". Otherwise it is hidden.

The UC view reuses the Activities layout (list on the left, entry on the right) with these differences:
- Limit 20, and the count reads "N / 20".
- "From My Record, not on the list" includes both activities and awards (awards marked with the award diamond).
- Each entry has: Category as six pills (an award preselects "Award or honor"; activities preselect from their My Record category when it maps obviously: volunteering → Volunteering/community service, paid-work → Work experience, academic-enrichment → Educational preparation program, otherwise Extracurricular activity), the facts strip from My Record, and one Description textarea with a plain character count and no limit. Note under it: "UC does not publish this limit. Check it when the UC application opens on August 1, 2027."
- A prefill link on an empty UC description: "Start from your Common App text" copies the Common App description when one exists.
- "Copy all" copies the UC list when the UC view is open, in the same format with "Category:" added.

### Part E tests

`ensureUcAppList`; category prefill mapping; UC copy text.

**Stop here and report.**

---

## Out of scope

- Materials and Writing.
- Any suggested or generated text. The student writes every word.

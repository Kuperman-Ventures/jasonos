# Cursor Prompt - Application Prep Rebuilt From My Record

Repo: `Kuperman-Ventures/jasonos`, production branch `cursor/kyle-college-portal-cb3a`, app folder `college/`.
Written against commit `5b78bf8` ("Merge school submissions and Common App Guide onto the portal branch").

Reference mockup: `college/docs/application-prep.html` (add the attached file to the repo before starting). It is clickable: switch between Activities and Honors, pick entries, type in the fields to see the counters. Where this prompt and the mockup disagree, this prompt wins. The draft text, hours and robotics role in the mockup are placeholders.

Build in two parts. **Stop after each part**, run `npm test`, and report with screenshots at desktop width and 390px, light and dark.

Applies throughout: plain second-person copy, hyphens rather than em dashes, tokens from `app/tokens.css` only, `--font-serif` for headings as on My Record, no `.stack-field` / `.label` form styling, and edit controls only when `canEdit` is true.

---

## Why this change

Application Prep (`PrepView` in `components/ActivitiesJournal.tsx`, line ~1648) is where the student turns My Record into what the Common App asks for. Today it:

- makes him create and name a list ("Early Decision shortlist") before he can write anything
- adds activities one at a time from a dropdown
- asks him to retype facts My Record already has, such as grades and time commitment, as free text
- has a "Long description" field (350 characters) that the Common App activities section does not use
- has no place for the Common App's 5 honors
- never marks a draft as out of date: `markDraftsStaleForActivity` exists in the lib but nothing calls it

After this change, Application Prep is one Common App list, created automatically. Facts come from My Record, and the student writes only the three text fields the Common App asks for (position, organization, description), plus the yes/no college question and up to 5 honors.

Kyle's list: 36 schools use the Common App, 4 use the UC Application and MIT has its own. This prompt covers the Common App only. The UC Application's Activities & Awards section works differently (up to 20 entries, longer descriptions) and is a later step.

---

## Part A - Common App activities

### A1. One list, created automatically

In `lib/activities-journal.ts`:

```ts
export const COMMON_APP_LIST_ID = "common-app";

/** Returns the journal with a "Common App" list, creating it if missing. Pure. */
export function ensureCommonAppList(journal: ActivitiesJournal): ActivitiesJournal;
```

`PrepView` works only with this list. When it is missing and `canEdit` is true, call `onChange(ensureCommonAppList(journal))` once on mount. When `canEdit` is false, render from a computed list without saving.

Remove from the UI: the list `<select>`, the "New list" form, the "Verify character limits" reminder and the "Export .md" button (Part B replaces it). Keep `createApplicationList` and the `applicationLists` array in the data model, since other lists may come back for the UC Application later. The live journal has no lists today, so there is nothing to migrate.

### A2. Data changes

On `ApplicationDraft`, add:

```ts
continueInCollegeChoice?: boolean | null; // replaces the free-text continueInCollege in the UI
```

Normalize it. Keep `continueInCollege`, `longDescription`, `gradesReviewed` and `timeCommitmentReviewed` in the type and normalizer so old data is not lost, but stop showing them.

`reviewStatus` and `reviewedAt` stay. "Ready" means `reviewStatus === "reviewed"`.

### A3. Facts derived from My Record

Pure helpers in `lib/activities-journal.ts`, all tested:

```ts
/** Distinct grades 9-12 with a completed or in_progress period, ascending. */
export function commonAppGrades(activity: Activity): number[];

/** "School year", "School break" or "All year", from the periods' periodKind. */
export function commonAppTiming(activity: Activity): string | null;

/** Hours per week and weeks per year from the latest period that has them. */
export function commonAppTime(activity: Activity): { hoursPerWeek: number | null; weeksPerYear: number | null };

/** True when the activity changed after the draft was marked ready. */
export function isDraftStale(draft: ApplicationDraft, activity: Activity): boolean;
```

Timing rules: periods whose kind is `school_year` only → "School year". `summer` only → "School break". `all_year`, or a mix of school year and summer → "All year". `custom` alone → null.

`isDraftStale`: `reviewStatus === "reviewed"` and `activity.updatedAt` is later than `draft.reviewedAt`. This replaces the unused `markDraftsStaleForActivity`. Delete that function and its test.

### A4. Layout

Header (same pattern as My Record):

- `<h3>` in `--font-serif`: "Application Prep"
- Summary line from a pure helper `prepSummary(list, journal)`: "3 of 10 activities chosen, 1 ready. 0 of 5 honors chosen. Built from My Record, in Common App fields."
- On the right: "Copy all for the Common App" secondary button (Part B).

Below the header, a two-option pill toggle: "Activities" and "Honors". Keep the choice in component state only.

**Activities view** is a two-column grid: `300px minmax(0, 1fr)`, gap 36px. Under 820px it is one column, with the list first.

**Left column, "Your list":**

- Heading `<h3>` in `--font-serif` 20px: "Your list", with "3 / 10" in mono on the right. 2px `--color-text` rule below.
- An ordered list of the chosen entries. Each row: position number (mono), activity name (600) with a muted line under it (Common App grades, for example "9th-11th", plus "since 6th" when My Record has earlier grades), and a state tag on the right:
  - "Draft" (`--color-surface` / `--text-subtle`)
  - "Ready" (`--color-surface` background, `--text-done` text, 1px `--color-done` border)
  - "Over limit" (`--color-accent-tint` / `--text-accent`), when any field is over its limit
  - "Changed" (`--color-accent-tint` / `--text-accent`), when `isDraftStale` is true
- The selected row has a `--color-raised` background and a 3px inset `--color-accent` left edge. Clicking a row selects it.
- Hint under the list (13px, muted): "Colleges see them in this order. Put the ones that matter most to you first."
- Below that, a mono uppercase label "From My Record, not on the list", then every non-archived My Record activity not yet chosen. Each shows its name, a muted fact ("9th-11th · 3 yrs", "Middle school only" or "Grades not set") and an "Add" strong text link (canEdit). "Add" is disabled when 10 are already chosen, with the hint "The Common App holds 10. Remove one to add another."
- Sort the not-chosen activities by Common App years (most first), then by name.
- Adding an activity creates its draft with `draftRole` and `draftOrg` prefilled from the activity's role and organization, cut to the field limits, and selects it.

**Right column, the selected entry:**

- Heading `<h3>` in `--font-serif` 24px: the activity name, with the `ActivityIcon` used elsewhere. On the right (canEdit): "Move up", "Move down", "Remove" text links. Remove drops it from the list, not from My Record.
- **Facts strip** (raised box, 1px `--color-border`, four cells): Grades, Timing, Hours per week, Weeks per year. Values come from A3. A missing value shows "Add in My Record" as a strong text link that opens the activity in My Record on the "Participation & Roles" tab (use the existing `onOpenActivity` path and switch the view to `my`). Under the strip (12px, muted): "These come from My Record. Change them there and they update here."
- When the activity has middle-school grades, add (12px, muted): "The Common App lists grades 9-12. Your earlier years belong in your essays."
- **Fields**, each with a borderless input (2px `--color-text` bottom border, `--color-accent` on focus, `--status-failing` when over the limit), a label (15px, 600) and a counter on the right ("23 / 50", mono, `--status-failing` when over):
  - "Position or leadership": 50 characters
  - "Organization": 100 characters
  - "Description": 150 characters, a 3-row textarea, with the muted label note "about 20-25 words"
- "Do you plan to do this in college?" with Yes / No pills, saved to `continueInCollegeChoice`.
- Footer: primary button "Mark as ready" (sets `reviewStatus: "reviewed"` and `reviewedAt: now`). When ready, it reads "Ready - mark as draft" and reverts on click. It is disabled while any field is over its limit, with the note "Shorten the fields in red first." in `--status-failing`. Editing any field of a ready entry sets it back to draft.
- When `isDraftStale` is true, show a line above the footer: "My Record changed after you marked this ready. Check the facts and text, then mark it ready again."
- **"From My Record" notes** under a 1px rule (mono uppercase label), as a two-column definition list: Role, What you do (`responsibilities`), Why it matters (`reflections.whyMatters`), Updates (the three latest `whatHappened` lines with dates), Awards (titles of awards linked to this activity). Empty ones read "Not added yet" or "None yet" in muted text. If all are empty, add the strong link "Add details in My Record" with the muted text "to have more to draft from."

Use the existing `CharCounter` logic (`charCount`, which counts characters with `[...text].length`) so emoji and accented letters count the way the Common App counts them.

Empty state, when My Record has no activities: "Your list is empty because My Record is empty." with a strong link "Go to My Record".

### A5. Remove

- The old `PrepView` markup: list select, create form, add-activity select, the Source notes / Draft split, the Long description field, Grades reviewed, Time commitment, and the free-text Continue in college field.
- CSS used only by those: `.aj-prep-lists`, `.aj-prep-create`, `.aj-prep-add`, `.aj-prep-split`, `.aj-prep-source`, `.aj-prep-draft`, `.aj-reminder`, unless something else uses them.

### Part A tests

- `ensureCommonAppList` creates one list once and is a no-op when it exists.
- `commonAppGrades` ignores grades 6-8, `post`, `other` and `planned` periods.
- `commonAppTiming`: the four cases.
- `commonAppTime`: picks the latest period that has hours.
- `isDraftStale`: draft not reviewed → false; reviewed, then activity updated later → true.
- `prepSummary` wording for 0, 1 and several.
- Round-trip of `continueInCollegeChoice`.

**Stop here and report.**

---

## Part B - Honors and copy-out

### B1. Honors data

On `ApplicationList`, add:

```ts
honors?: HonorDraft[];

export type HonorLevel = "school" | "state_regional" | "national" | "international";

export type HonorDraft = {
  id: string;
  awardId: string;      // the My Record award it came from
  sortOrder: number;
  title: string;
  grades: number[];     // subset of 9-12
  level: HonorLevel | null;
  reviewStatus?: "draft" | "reviewed";
};

export const HONOR_LIMITS = { count: 5, title: 100 } as const;
```

Normalize all of it. Drop honors whose `awardId` no longer matches an award in the journal.

The Common App's own guide confirms up to 5 academic honors, each with a title, when it was received and a level of recognition. The 100-character title limit and the four level names are the commonly published values. Keep them in `HONOR_LIMITS` and a `HONOR_LEVEL_LABEL` map so they can be changed in one place when the Common App opens on August 1, 2027.

### B2. Honors view

When the "Honors" pill is selected, show a single column (max 720px):

- Heading "Honors" in `--font-serif` 20px with "0 / 5" on the right.
- Hint (13px, muted): "The Common App asks for up to 5 academic honors from high school. Other recognition can go in an activity's description."
- **Chosen honors**, each as a raised card:
  - the title field with a 100-character counter, prefilled from the award title
  - "Grades" as four toggle pills (9, 10, 11, 12), prefilled from the award's grade when it is 9-12
  - "Level" as four single-choice pills: School, State or regional, National, International. Prefill when the award's `recognitionLevel` text contains one of those words (case-insensitive).
  - "Move up", "Move down", "Remove" text links, and the same "Mark as ready" behavior as activities. The button is disabled until the title is within the limit and at least one grade and a level are chosen.
- **Not chosen:** "From My Record, not on the list" with every non-archived award and an "Add" link (disabled at 5). Awards marked `academic === false` show the muted note "Not marked academic" but can still be added.
- **Empty:** when there are no awards, a dashed box: "No awards in My Record yet." with the strong link "Add an award in My Record", which opens My Record scrolled to the Awards and Recognition section.

### B3. Copy all for the Common App

The header button copies plain text in the order the Common App asks, so the student can paste field by field. Pure helper `commonAppCopyText(list, journal): string`, tested, producing:

```
ACTIVITIES

1. Marching band
Position or leadership: Trumpet section
Organization: Columbia High School Marching Band
Description: ...
Grades: 9, 10, 11
Timing: School year
Hours per week: 6
Weeks per year: 30
Plan to continue in college: Yes

2. ...

HONORS

1. ...
Grades: 10
Level: State or regional
```

Leave out lines with no value. Use `navigator.clipboard.writeText` inside the click handler, as `components/CollegeRecord.tsx` (line ~288) does. On success, the button reads "Copied" for 2 seconds. On failure, open a read-only textarea with the text selected and the note "Copy failed. Select the text and copy it yourself."

### Part B tests

- Honor normalizing: unknown level → null, grades outside 9-12 dropped, honor with a missing award dropped.
- Level prefill from `recognitionLevel` text.
- `commonAppCopyText` with two activities and one honor matches the expected text exactly, including omitted empty lines.

**Stop here and report.**

---

## Out of scope

- UC Application Activities & Awards (4 schools on the list) and the MIT application.
- Writing help or suggested text of any kind. The student writes every word.
- Plan tab (next prompt, after threads ship).

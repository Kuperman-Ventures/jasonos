# Cursor Prompt - My Record and Save-As-You-Go Recall

Repo: `Kuperman-Ventures/jasonos`, production branch `cursor/kyle-college-portal-cb3a`, app folder `college/`.
Written against commit `1254903` ("Merge Source Serif display optical size for Recall").

Reference mockup: `college/docs/my-record.html` (add the attached file to the repo before starting). It is clickable: the strip at the top switches between "Right after Recall" (Part A) and "With threads" (Part B). Where this prompt and the mockup disagree, this prompt wins. The award and thread names in the mockup are examples.

Build in two parts. **Stop after Part A**, run `npm test`, and report with screenshots of My Record (with activities, and empty), the quick-add card open, and a Recall question screen, at desktop width and 390px, light and dark. Then do Part B.

---

## Why this change

The Activities section has three jobs: gather what the student has done, plan what comes next, and turn both into what the application forms ask for. Today the gathering side is split across three places that work differently:

- **Recall** (the nine questions) shows the student a grade-by-grade picture of his activities, then sends him back to a card list with search and filter dropdowns where that picture is gone.
- **"Add activity"** opens the old long form.
- **Awards & Milestones** is a separate tab, although awards belong to activities and grades.

Recall also holds every answer in memory until the last screen. Clicking the left rail, switching tabs or refreshing loses all of them with no warning.

This change makes **My Record** the single view of what the student has done. It is laid out grade by grade, the same as Recall's review screen, with awards shown on the rows they belong to. Recall and quick add both save each answer the moment it is entered and both lead back to My Record.

Applies throughout:

- UI copy is plain, second person, short sentences. Hyphens, not em dashes.
- Use only tokens from `app/tokens.css` and the Recall type scale already in `globals.css` (`--font-serif` for headings). Check `[data-mode="dark"]`.
- Edit controls appear only when `canEdit` is true.

---

## Part A - My Record, quick add, save-as-you-go Recall

### A1. Tabs

In `lib/apps-materials.ts`:

```ts
export type ActivitiesViewId = "my" | "prep";

export const ACTIVITIES_VIEWS = [
  { id: "my", label: "My Record" },
  { id: "prep", label: "Application Prep" },
];
```

The Awards & Milestones tab is removed. `resolveActivitiesView` already falls back to `"my"` for unknown values, so old `av=awards` links land on My Record. Update `lib/apps-materials.test.ts` and `docs/APP_MAP.md` (the Apps & Materials `av=` line).

### A2. Save-as-you-go Recall

Rework `components/ActivitiesRecall.tsx` so each answer is saved as an activity as soon as it is entered.

**New pure helpers in `lib/activities-journal.ts`** (all tested):

```ts
/** The periods Recall creates for a span. Extract this from activityFromRecall and have activityFromRecall call it. */
export function recallPeriods(
  classOf: number,
  span: { sinceGrade?: number; untilGrade?: number; stillDoing: boolean },
  now?: Date,
): ParticipationPeriod[];

/** Replace an activity's periods with the Recall span. Sets ongoing, startYear, updatedAt. */
export function applyRecallSpan(
  journal: ActivitiesJournal,
  activityId: string,
  classOf: number,
  span: { sinceGrade?: number; untilGrade?: number; stillDoing: boolean },
  now?: Date,
): ActivitiesJournal;

/** Hard-delete an activity. Only used for activities created in the current Recall or quick-add session. */
export function removeActivity(journal: ActivitiesJournal, activityId: string): ActivitiesJournal;
```

**Behavior:**

- **Add** (Enter or the Add button): if the name matches a non-archived activity (case-insensitive, trimmed), show "{name} is already in My Record." and do not create anything. Otherwise create the activity with `activityFromRecall` (no start grade yet, the question's `defaultCategory` or `other`, `stillDoing: true`) and call `onChange(upsertActivity(...))` immediately.
- Keep a local list of the activity ids created in this session, plus per-id UI state (`question`, `editing`, `pickMode`, `since`, `until`, `stillDoing`). The answer cards and the running list read names from the journal, so they always match what is saved.
- **Grade tap, "Still doing it", "I stopped"**: update the local state and call `onChange(applyRecallSpan(...))` when the span is complete (a start grade is set, and an end grade too when stopped).
- **Remove** on an answer card: `onChange(removeActivity(...))` and drop the id from the session list.
- **Delete the review screen** (step 10) and its CSS (`.aj-recall-review*`, `.aj-recall-seg`, `.aj-recall-span-note`, `.aj-recall-already`, `.aj-recall-missing`, `.aj-recall-next-note`). On question 9 the primary button reads **"See my record"**.
- **Delete the unsaved-answers prompt** (`leavePrompt`) and `requestExit`. Nothing is unsaved. The top-left link on the start screen and question 1 reads "← Back to My Record" and calls `onExit`.
- `onDone` and `onExit` both receive the session ids: `onDone(ids: string[])`. `MyActivitiesView` stores them as `highlightIds` (local state) so My Record can mark those rows as new. Clear `highlightIds` when the student leaves the My Record view.
- Extract the answer card (name, Remove, prompt line, `GradeStrip` pick, the two pills, Done/Change, closed summary) into `components/RecallAnswerCard.tsx` so quick add (A5) uses the same component.

**Saving often.** Recall and quick add now save on every add and grade tap. In `components/Portal.tsx`, `changeJournal` (line ~577) calls `patchState` on every change, so two quick saves can arrive out of order. Change it to update local state immediately and debounce `patchState` by 500ms, always sending the latest journal. Flush the pending save immediately on `visibilitychange` to hidden and on unmount. The save indicator shows "Saving..." while a save is pending.

### A3. My Record layout

Replace the body of `MyActivitiesView` in `components/ActivitiesJournal.tsx` (when Recall is not showing and no activity is open).

**Remove:**

- The `.aj-head` header with "Add activity", "Add more with questions" and "Add update"
- `.aj-filters` (search, category, grade and status filters)
- The global `AddActivityForm` and `AddUpdateForm` in this view (`AddUpdateForm` stays in `ActivityDetail`)
- The card list (`.aj-card-list` cards with the status pill, "Grades: ..." line and latest-update snippet)
- `AddActivityForm` itself, if nothing else uses it

**Header:**

- Heading `<h3>` in `--font-serif`, 500 weight, `clamp(26px, 4vw, 34px)`: "My Record"
- Summary line (16px, `--text-muted`) from a pure helper `recordSummary(journal, currentGrade): string`:
  - "5 activities. Your longest are Band and Trumpet, at 6 school years each."
  - One longest: "5 activities. Your longest is Trumpet, at 6 school years."
  - No activity with grades yet: "5 activities."
  - "School years" for an activity = the number of distinct grades with a `completed` or `in_progress` period.
  - When several activities share the longest span, name at most two (alphabetical), then "and N more".
- On the right (canEdit): secondary button "Add with questions" (opens Recall).
- A search input appears under the header only when there are more than 12 non-archived activities. It filters by name, organization and role. Placeholder: "Find an activity".

**Grade header row** (once, above the rows): "Middle school" over 6-8 and "High school" over 9-12 (mono, 10px, uppercase, `--text-subtle`), then the grade numbers. The current grade reads "11 now" in `--text-accent`. Use the same column template as the rows so the numbers line up with the cells.

**Rows.** One row per non-archived activity. Sort by earliest grade with a `completed` or `in_progress` period, then by name. Activities with no such period go last.

Each row is a CSS grid: `minmax(0, 1fr) 300px 64px 120px`, gap 20px, padding 12px 0, 1px `--color-rule` bottom border.

1. **Name block:**
   - The activity name as a text button (16px, 600, underline on hover). It opens the activity (`onOpenActivity`).
   - Meta line under it (13px, `--text-subtle`): "New" (mono 10px uppercase `--text-accent`) when the id is in `highlightIds`, then the span sentence from a pure helper `recordSpanText(activity, currentGrade)`:
     - Ongoing and has the current grade: "Since 6th grade · still doing it"
     - Otherwise: "9th to 10th grade", or "9th grade" for one year
     - No periods: "Start grade not set"
   - If the activity has a role or organization, add " · {role}, {organization}" (whichever exist).
2. **Grade strip** in a new `row` size (see A4).
3. **Years:** "6 yrs" / "1 yr" (13px, `--text-subtle`, tabular numbers). Blank when there are no periods.
4. **Action** (canEdit), right-aligned: "Add details" as a strong text link (`--text-accent`, 600) when `activityNeedsDetails` is true. Otherwise empty.

Rows in `highlightIds` get a background gradient from `--color-accent-tint` to transparent.

Under 760px each row stacks: name block and years on the first line, the strip full width on the second line, the action on the third. The grade header row hides its empty columns and spans the full width.

At the bottom of the list, when there are archived activities: "Show archived (N)" text link. It reveals them in a muted list with "Restore" links. Add `restoreActivity(journal, id)` to the lib.

**Empty state:**

- canEdit with no activities: Recall opens automatically, as it does today.
- Read-only with no activities: "No activities yet." in `--text-subtle`.

### A4. GradeStrip `row` size

Extend `components/GradeStrip.tsx`. The `row` size reads periods instead of a since/until span, because activities edited in the detail view can have gaps.

```ts
type GradeCellState = "completed" | "in_progress" | "planned" | null;

// added props
cells?: Record<number, GradeCellState>;          // used when size === "row"
markers?: { grade: number; title: string }[];    // award markers
onEmptyClick?: () => void;                       // row size only, when every cell is null
```

Add a pure helper `gradeCells(activity): Record<number, GradeCellState>` to the lib. When a grade has several periods, use the strongest state: `in_progress` > `completed` > `planned`. Grades `post` and `other` are ignored.

Row size rendering:

- 22px tall, same seven columns and 8px gap between 8th and 9th as the grade header.
- `completed` or `in_progress` → `--color-accent-tint-2`. `in_progress` in the current grade → `--color-accent`.
- `planned` → 1px inset `--color-dash` outline with a light diagonal hatch from `--color-surface` (used by Plan in step 2).
- `null` at or before the current grade → `--color-surface` (an empty track). `null` after the current grade → transparent.
- Adjacent filled cells join into one bar with 3px rounded outer ends. The 8px gap fills too when both 8th and 9th are filled.
- Award markers: an 8px square rotated 45° in `--milestone` (from `tokens.css`), centered in the cell, with a 2px `--color-bg` outline. The cell gets a `title` with the award title.
- When every cell is null, render the strong text link "Add the grades you did this" in place of the strip. It calls `onEmptyClick`, which opens the activity on its "Participation & Roles" tab. Add an optional `initialTab` prop to `ActivityDetail` for this.
- The strip has `role="img"` and an `aria-label` built from the span sentence, for example "Trumpet: since 6th grade, still doing it".

### A5. Quick add

Under the last row (canEdit): a strong text link "+ Add one activity". It opens an inline card (max-width 640px, `--color-raised`, 1px `--color-border`, 4px radius) containing:

- A borderless answer input with Add button, the same as Recall. Placeholder: "What's the activity?"
- Below it, once an activity has been added, `RecallAnswerCard` for that activity, with the prompt "Then tap the grade you started."
- A "Cancel" text link that closes the card. If an activity was already added, it stays.

Adding uses the same create, duplicate check and `applyRecallSpan` path as Recall, with category `other`. When the grade is set, close the card, add the id to `highlightIds`, and show the "+ Add one activity" link again.

### A6. Awards on My Record

Below the rows, a section with an `<h3>` in `--font-serif` (22px, 500): "Awards and Recognition", with a 2px `--color-text` bottom rule. On the right of the heading (canEdit): strong text link "+ Add an award". It opens the existing `AddAwardForm` inline below the heading.

Each award (non-archived) is a row: a rotated-square marker, the title (600), and a muted line with grade, linked activity name and recognition level, whichever exist, joined by " · ". On the right (canEdit): "Remove" text link (calls `archiveAward`).

Awards that have both `activityId` and `grade` also appear as markers on that activity's row (A4).

Under the list (13px, muted): "Awards linked to an activity also show as a marker on that activity's row."

Empty: "No awards yet." in `--text-subtle`.

Delete `AwardsView` and the "Milestones from updates" section. Update recognition text stays on each update in the activity detail.

### Part A tests

- `recallPeriods` returns the same periods `activityFromRecall` did before (keep the existing `activityFromRecall` tests passing).
- `applyRecallSpan`: since 6, still doing, classOf 2028 on 2026-10-03 → 6 periods; then stopped at 9 → 4 periods, `ongoing` false.
- `removeActivity` and `restoreActivity`.
- `gradeCells`: strongest-state rule, ignores `post` and `other`.
- `recordSpanText`: the three cases.
- `recordSummary`: one longest, two tied, three tied ("and 1 more"), no grades.
- `lib/apps-materials.test.ts`: two views; `resolveActivitiesView("awards")` → `"my"`.

**Stop here and report.**

---

## Part B - Threads on My Record

A thread is a theme the student names that groups related activities, for example everything he does with music. Threads replace the separate "Timeline & Threads" tab described in `college-list-activities-recall-threads-plan.md` Part 3. That tab will not be built. Its data model is used here.

### Data model

Add to `lib/activities-journal.ts` (normalize all of it and add round-trip tests):

```ts
export type ThreadPlan = {
  deeper?: string;
  lead?: string;
  outsideSchool?: string;
  makeSomething?: string;
  connect?: string;
};

export type ActivityThread = {
  id: string;
  name: string;
  plan?: ThreadPlan; // used by Plan in step 2
  createdAt: string;
  updatedAt: string;
};

// on ActivitiesJournal
threads?: ActivityThread[];

// on Activity
threadId?: string;
```

Drop threads with no name. Keep `threadId` only if it matches a thread in the same journal. Helpers: `createThread(journal, name)`, `renameThread`, `deleteThread` (clears `threadId` on its activities), `assignActivityToThread(journal, activityId, threadId | null)`.

### UI

**Before any threads exist,** when there are 3 or more non-archived activities, show a prompt under the rows (`--color-raised` background, 3px `--color-accent` left border, 14px):

- Text: "Some of these go together. Group them into threads, like everything you do with music."
- Strong text link (canEdit): "Group into threads". It switches My Record into grouping mode and opens the new-thread name input.

**Grouped layout** (once any thread exists, the rows are always grouped):

- Each thread is a group with a header row: the thread name as an `<h3>` in `--font-serif` (20px, 500), the count ("3 activities"), and (canEdit) "Rename" and "Delete" text links on the right. The header has a 2px `--color-text` bottom rule.
- Activities with no thread go in a last group titled "Not in a thread" (Archivo 14px 600, `--text-subtle`, 1px `--color-border` rule), with a "+ New thread" strong text link on the right.
- Within each group, rows keep the A3 sort order.
- Rename is inline: the heading becomes a borderless input with Save and Cancel text links.
- Delete asks inline: "Delete the {name} thread? The activities stay in My Record." with "Delete" and "Cancel".

**Moving an activity to a thread** (canEdit): in grouped layout, the row action column shows a "Move" text link next to "Add details". It opens a small popover listing the threads, "Not in a thread" and "+ New thread". Choosing one calls `assignActivityToThread`. A popover is right here because the list can grow; do not use a `<select>`.

**New thread:** an inline borderless input with an Add button, placeholder "Name the thread". The name is the student's own. Do not suggest names.

### Part B tests

- Round-trip of `threads` and `threadId`. A `threadId` pointing at a missing thread is dropped.
- `deleteThread` clears `threadId` on its activities.
- `assignActivityToThread` to `null` clears it.

**Stop here and report.**

---

## Out of scope (next steps)

- **Plan** tab (self-started project planner and per-thread questions). It will write `planned` periods that show as hatched cells in the `row` strip.
- **Application Prep** rebuild: one Common App list created automatically, entries drafted from My Record, honors from awards.
- Redesign of the activity detail view (`ActivityDetail` and its five tabs).

# Cursor Prompt - Activities Recall: Visual and Interaction Redesign

Repo: `Kuperman-Ventures/jasonos`, production branch `cursor/kyle-college-portal-cb3a`, app folder `college/`.
Written against commit `228a90c` ("Merge Activities Recall (Part 1)") and the live page at `/?tab=apps&am=activities`.

Reference mockup: `college/docs/activities-recall.html` (add the attached file to the repo before starting). Open it in a browser. It is clickable and shows the three screens. Where this prompt and the mockup disagree, this prompt wins.

This prompt changes how Recall looks and behaves. It does not change the data model, the questions, or what gets saved, except for one simplification in section 7.

Do this as one change. When done, report with screenshots of the start screen, a question screen with three answers, and the review screen, each at desktop width and at 390px, in light and dark mode.

---

## 1. What is wrong with the current version

Part 1 shipped the right behavior with form-style UI. A student opening it feels like he is filling out paperwork:

1. **It sits inside the list page.** Recall renders below the My Activities header buttons and the Search / Category / Grade / Status filters (`MyActivitiesView` in `components/ActivitiesJournal.tsx`, lines ~357-436). The filters stay on screen above it.
2. **Form labels everywhere.** Every field uses `.stack-field` with the small uppercase monospace `.label` style ("WHAT YEAR DO YOU GRADUATE FROM HIGH SCHOOL?"). That is the app's style for data entry.
3. **Dropdowns for everything.** Graduation year, Since, Until and Type are all `<select>` elements.
4. **Each answer becomes a row of fields** (name input, Since select, checkbox, Until select, ×) in `.aj-recall-row`.
5. **The review screen is a table of dropdowns**, including a Type select on every row.
6. **Three equal buttons** (Back, Skip, Next) at the bottom of every question, like a multi-page form.
7. **No way out.** There is no exit until the student finishes all nine questions.
8. **No sense of progress.** Answers from earlier questions disappear from view.

## 2. Design direction

Recall should feel like a short conversation that builds a picture of what the student has done. Four principles:

- **One thing on screen at a time.** Recall takes over the whole Activities area. The question is the largest thing on the page.
- **Tap, don't fill in.** Grades are picked by tapping a row of grade cells. No dropdowns anywhere in Recall.
- **Show the record growing.** A running list beside the questions shows every answer so far as a small grade bar. The review screen shows everything as a grade-by-grade timeline. That picture is the reward. No points, badges or progress meters.
- **Ask for only one detail now.** Name and start grade. Everything else (type, role, hours) is collected later through "Add details".

## 3. Typography and tokens

`app/layout.tsx` already loads Source Serif 4 as `--font-source-serif`, and nothing uses it. Use it for Recall's questions and headings only.

In `app/globals.css`, next to `--font-heading` (line ~60), add:

```css
--font-serif: var(--font-source-serif), Georgia, "Times New Roman", serif;
```

Type scale for Recall:

| Element | Font | Size | Weight |
|---|---|---|---|
| Question and screen headings | `--font-serif` | `clamp(26px, 4vw, 36px)`, line-height 1.18, `text-wrap: balance` | 500 |
| Helper line under the question | `--font-body` | 16px, `--text-muted`, max 52ch | 400 |
| Answer input | `--font-body` | 20px | 400 |
| Answer name on a card | `--font-body` | 18px | 600 |
| Question counter, grade group labels, "Your list so far" label | `--font-mono` | 11-12px, uppercase where noted, letter-spacing .08-.1em, `--text-subtle` | 400-500 |

Do not use `.stack-field` / `.label` anywhere in Recall. Do not use `.field` on any Recall input.

Colors come only from `app/tokens.css`: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-raised`, `--color-border`, `--color-rule`, `--color-dash`, `--color-text`, `--text-muted`, `--text-subtle`, `--text-placeholder`, `--color-accent`, `--color-accent-pressed`, `--color-accent-tint`, `--color-accent-tint-2`, `--text-accent`. Check every screen in `[data-mode="dark"]`.

## 4. Where Recall renders

In `MyActivitiesView` (`components/ActivitiesJournal.tsx`): when `showRecall` is true, render **only** `<ActivitiesRecall />` below the view tabs. Hide the `.aj-head` header and its buttons, `.aj-filters`, `AddActivityForm`, `AddUpdateForm`, the empty state and the card list.

Keep the "Add more with questions" button in the header for when Recall is closed.

Add an `onExit` prop to `ActivitiesRecall`. Every screen has a text link at top left. On the start screen and question 1 it reads "← Back to My Activities". If there are unsaved answers when the student leaves, show an inline message in place of the screen content (not a browser dialog):

- Text: "You have N answers that aren't saved yet."
- Buttons: "Keep going" (primary, returns to the screen) and "Leave without saving" (text link, calls `onExit`).

`onExit` sets `recallOpen` false and `recallDismissed` true, same as `onDone` today.

Layout inside Recall:

- A top bar row: back link on the left, question counter ("Question 3 of 9", mono, tabular numbers) on the right.
- Below it, a two-column grid: main column (max 640px) and a 280px running-list column, gap 48px. Below 860px, one column with the running list after the footer buttons.
- The start screen and review screen use the main column only (no running list). The review table can use the full width.

## 5. The three screens

Copy in quotes is exact.

### 5a. Start screen (only when `journal.profile?.classOf` is missing)

- Heading (serif): "Start Your Activities List"
- Paragraph (17px, `--text-muted`, max 54ch): "You'll answer nine short questions about what you do. A few words per answer is enough. You can add details like your role and hours later."
- A short numbered list (the numbers are a real sequence). Number in mono `--text-accent`, text 15px:
  1. "Type anything that comes to mind. Small things count."
  2. "Tap the grade you started. That's the only detail we ask for now."
  3. "At the end you'll see everything laid out grade by grade."
- Prompt (16px, 600): "What year do you graduate from high school?"
- Four year buttons in a row (wrap on phones): the current school year's end year through +3 (in the 2026-27 school year: 2027, 2028, 2029, 2030). Serif 22px numbers, `--color-raised` background, 1px `--color-border`, 4px radius, padding 10px 22px. Selected: `--color-accent` border, `--color-accent-tint` background, `--text-accent` text. Use `aria-pressed`.
- After a year is picked, a muted line under the buttons: "That makes you a junior this year." (freshman / sophomore / junior / senior from `currentGrade()`).
- Primary button: "Start with question 1". Disabled until a year is picked.

If `classOf` is already set, Recall opens directly on question 1.

### 5b. Question screen

From top:

1. Question (serif heading).
2. Helper line: "For example:" in `--text-subtle`, then the helper text from `RECALL_QUESTIONS`.
3. **Answer input.** A single line with no box: transparent background, 2px bottom border in `--color-text` (turns `--color-accent` on focus), 20px text, placeholder "Type one thing, then press Enter". On the right, an "Add" button (accent fill, 14px, 600), disabled while the input is empty. It is a `<form>`, so Enter and the button both add. After adding, clear the input and keep focus in it. Phones need the button because the keyboard's Enter key is not obvious.
4. Duplicate message (13px, `--text-subtle`, `aria-live="polite"`): "{name} is already on your list." Clear it on the next add or when moving to another question. Drop the 3-second timer.
5. **Answer cards** for this question, newest last. See section 6.
6. Footer:
   - Primary button: "Next question". On question 9 it reads "See your list".
   - Text link next to it, shown only when this question has no answers: "Nothing for this one". It does the same as Next.
   - Remove the separate Skip and Back buttons. "← Previous question" moves to the top bar (on question 1 it is "← Back to My Activities", or "← Back" to the start screen if the start screen was shown).

Running list column (right side, or below on phones):

- Top border 2px `--color-text`, then a mono uppercase label "Your list so far" with the count on the right.
- Every answer from every question, in the order added: name (14px, 600), a read-only grade bar (section 6, 10px tall), and one line of muted text, either the span sentence or "Start grade not set yet".
- Empty state: "Everything you add shows up here."
- Sticky on desktop (`position: sticky; top: 20px`).

### 5c. Review screen

- Top bar: "← Back to the questions" (returns to question 9), and "Review" on the right in the counter style.
- Heading (serif): "Your Activities, Grade by Grade"
- Helper line. If at least one answer has a start grade: "You've done {name} for {N} school years. Check the grades, then add these to your list." using the answer with the most school years (ties: first added). Otherwise just "Check the grades, then add these to your list."
- A timeline `<table>` inside an `overflow-x: auto` wrapper (min-width 560px):
  - Header row 1: "Middle school" over 6-8 and "High school" over 9-12 (mono, 10px, uppercase).
  - Header row 2: the grade numbers. The current grade reads "11 · now" in `--text-accent`.
  - A 10px spacer column between 8 and 9. A bar that runs across the boundary fills the spacer too, so a five-year span reads as one continuous bar.
  - One row per answer, sorted by start grade, then name. Row header: the name (15px, 600). Cells: a 22px-tall bar segment. Filled grades use `--color-accent-tint-2`. The current grade, when still doing it, uses `--color-accent`. The first and last filled cells get 3px rounded outer corners. Last column: "6 yrs" (13px, muted).
  - Answers with no start grade show "Start grade not set - you can add it later." across the grade columns.
  - Rows separated by 1px `--color-rule`. No other borders.
  - Rows whose name matches an existing activity: show the name in `--text-subtle` with "Already in My Activities" under it, and leave the bar empty. They are not created.
- Primary button: "Add N activities to My Activities" (singular when 1).
- Under the button (15px, muted, max 58ch): "Next, each one gets an "Add details" button for your role, what you do, and hours. Nothing else is required now."

## 6. Answer card and grade strip

Create `components/GradeStrip.tsx`. It is used here three ways and will be reused by Timeline & Threads (Part 3), so keep it general.

```ts
type GradeStripProps = {
  since: number | null;      // 6-12
  until: number | null;      // 6-12, used when stillDoing is false
  stillDoing: boolean;
  currentGrade: number | null;
  size: "pick" | "mini";      // pick = 40px tall tappable cells (44px under 480px); mini = 10px read-only bar
  onPick?: (grade: number) => void;
  label: string;              // activity name, for aria labels
};
```

Rendering:

- Seven cells, 6 through 12, with a 10px gap between 8 and 9. In `pick` size, a mono uppercase caption row above reads "Middle school" over 6-8 and "High school" over 9-12.
- Cell states:
  - Filled (from `since` to the end grade): `--color-accent-tint-2` background, `--text-accent` number.
  - The current grade, when filled: `--color-accent` background, white number.
  - Future grades (after the current grade): transparent with a 1px inset `--color-dash` outline, disabled in `pick` size.
  - Otherwise: `--color-surface`, hover `--color-surface-2`.
- In `pick` size, a small "NOW" caption (mono 9px, `--text-accent`) sits under the current grade cell.
- Each `pick` cell is a `<button>` with `aria-label="{n}th grade"` and `aria-pressed` when it is the start or end grade. `mini` cells are `aria-hidden`; the text line next to them carries the meaning.
- Outer corners rounded 3px. No gaps between cells inside a school group, so a span reads as one bar.

Answer card (`<li>`), `--color-raised` background, 1px `--color-border`, 4px radius, padding 16px 18px:

**Open state** (new answer, or after "Change"):

- Top row: the name (18px, 600) on the left, "Remove" text link on the right.
- Prompt line (14px, muted):
  - No start grade yet: "What grade did you start?"
  - Stopped and choosing an end: "What grade did you stop?"
  - Otherwise: "Tap a different grade to change when you started."
- `GradeStrip` in `pick` size.
- A row of two pill toggles (`aria-pressed`): "Still doing it" (default) and "I stopped". Selected pill: 1px `--color-text` border, `--color-raised` background, 600 weight. When a start grade is set, a "Done" text link sits at the right of this row.

Behavior:

- "Still doing it" selected: tapping a grade sets the start grade and closes the card.
- "I stopped" selected: the first tap sets the start grade, the next tap on a grade at or after it sets the end grade and closes the card. Tapping a grade before the start grade moves the start instead.
- Switching to "Still doing it" clears the end grade.
- Adding a new answer closes any other open card on the screen.
- The name is not editable on the card. To fix a typo, remove the answer and add it again. (This removes the inline name input that made each answer look like a form row.)

**Closed state:**

- Top row: name and "Remove".
- `GradeStrip` in `mini` size.
- One line (14px, muted): the span sentence, and a "Change" text link at the right that reopens the card.

Span sentence, as a pure helper in `lib/activities-journal.ts`:

```ts
export function recallSpanText(since: number, until: number | null, stillDoing: boolean, currentGrade: number): string;
```

- Still doing: "Since 6th grade · still doing it · 6 school years"
- Stopped: "9th to 10th grade · 2 school years"
- One year: "school year" singular.
- Count runs from `since` through `currentGrade` (still doing) or `until` (stopped).

Motion: new cards fade up 4px over 180ms. Nothing else animates. Wrap it in `@media (prefers-reduced-motion: no-preference)`.

## 7. Remove Type from Recall

Drop the Type column and the category select from Recall entirely. On save, each answer uses its question's `defaultCategory`, or `other` when there is none. The `Capture.category` field stays internal and is not shown.

On `MyActivitiesView` cards, when an activity's category is `other`, do not print "Other" in the meta line. The existing "Add details" button covers it. In the activity's detail view, the category select stays as it is today.

## 8. CSS

In `app/globals.css`, replace the current Recall rules (`.aj-recall` through the `@media (max-width: 720px)` block that follows `.aj-recall-existing`) with new rules. Suggested class names:

`.aj-recall`, `.aj-recall-bar`, `.aj-recall-grid`, `.aj-recall-main`, `.aj-recall-q` (serif heading), `.aj-recall-help`, `.aj-recall-capture`, `.aj-recall-add`, `.aj-recall-dup`, `.aj-recall-items`, `.aj-recall-item`, `.aj-recall-item.is-closed`, `.aj-recall-pills`, `.aj-recall-foot`, `.aj-recall-tray`, `.aj-recall-years`, `.aj-recall-review`, `.aj-grade-strip`, `.aj-grade-strip--pick`, `.aj-grade-strip--mini`, `.aj-grade-cell`.

Remove the boxed `.aj-recall` container style (border, padding, raised background). Recall sits directly on the page background. Only answer cards and year buttons are boxed.

Keep `.aj-text-btn` and reuse it for every text link in Recall (back, Remove, Change, Done, Nothing for this one, Leave without saving).

## 9. Accessibility and phones

- The question heading is an `<h3>`. When the question changes, move focus to the answer input.
- All grade cells and pills are real `<button>` elements with visible focus (`outline: 2px solid var(--color-accent)`).
- At 390px: one column, running list below the footer, grade cells 44px tall, year buttons wrap, the review table scrolls inside its own wrapper and the page does not scroll sideways.

## 10. Tests

In `lib/activities-journal.test.ts`, add tests for `recallSpanText`:

- (6, null, true, 11) → "Since 6th grade · still doing it · 6 school years"
- (9, 10, false, 11) → "9th to 10th grade · 2 school years"
- (11, null, true, 11) → "Since 11th grade · still doing it · 1 school year"

Keep all existing Recall tests passing. `activityFromRecall` is unchanged.

## 11. Design rules for Parts 2-4

These replace the UI descriptions in `college-list-activities-recall-threads-plan.md` for the Self-Started Project planner, Timeline & Threads, and Next Two Years. Data model and behavior in that prompt are unchanged.

- Use the same building blocks as Recall: serif headings for questions, plain helper lines with "For example:", borderless answer inputs, raised cards only for things the student created, `.aj-text-btn` for secondary actions, `GradeStrip` for anything about grades.
- No `.stack-field` uppercase labels on any planning screen. The question is the label.
- No `<select>` where there are seven or fewer choices. Use a row of tappable pills or cells.
- **Project planner:** show one numbered question at a time in the main column, with the project's answers so far in the right-hand column (same pattern as Recall's running list). Partner status is a row of five pills (Not contacted, Contacted, Meeting held, Approved, Declined), not a select. Milestones are a vertical list with the month shown as a chip; tapping the chip opens the month input.
- **Timeline & Threads:** use `GradeStrip` in a new `row` size (22px tall, read-only, same look as the review table). Thread groups are headed by the thread name in the serif face.
- **Next Two Years:** one thread at a time, with the five questions under it and the thread's `GradeStrip` rows at the top so the student sees the record he is planning from.

# Cursor Prompt - Activities Started Before 6th Grade

Repo: `Kuperman-Ventures/jasonos`, production branch `cursor/kyle-college-portal-cb3a`, app folder `college/`.
Written against commit `5761870` ("Merge Gather landing for Apps & Materials into the college portal").

## Why

The Activities grid starts at 6th grade (`TRACK_GRADES` in `lib/activities-track.ts`). Many long-running activities start earlier: an instrument at 8, a martial art at 7, a sport in elementary school. A student who started in 3rd grade can only record "since 6th", which understates the commitment the section is built to show. The Common App only lists grades 9-12, so this matters for the student's story, essays and recommenders, not for the application form fields.

Also, once an activity is added in Gather, its start and end grades cannot be changed anywhere. This prompt adds a way to change them in Shape, which is also how an existing activity gets an earlier start.

Applies throughout: tokens from `tokens.css` only, existing pill and grade-square styles, plain copy, hyphens rather than em dashes, and no save before the journal has loaded.

## 1. Data

In `lib/activities-track.ts`:

- `TrackActivity.start` may now be 0-12, where 0 is kindergarten and 1-5 are grades 1-5. `normalizeAct` (line ~488) accepts 0 through `now` (today it clamps to 6-11 and falls back to 9). Keep the fallback of 9 for invalid values.
- Add `export const EARLY_GRADES = [0, 1, 2, 3, 4, 5] as const;` and `export function gradeName(g: number): string` → "kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade" ... "12th grade". Use it everywhere a grade is written out in a sentence. (Today the code writes `${g}th`, which reads wrong for 1st, 2nd and 3rd.)
- Add `export function activityYears(activity: TrackActivity, now: number): number` = (still ? now : end) - start + 1, minimum 1. Use it for every years count ("6 yrs", the thread length bar label, "Your record" panel). Do not count years from the grid cells any more, because the grid collapses grades K-5 into one column.

In `lib/activities-journal.ts`:

- Add `earliestGrade?: number` (0-5) to `Activity`. Normalize it (integer 0-5, otherwise drop it).
- In `applyTrackToJournal` (`lib/activities-track.ts`, line ~759): set `earliestGrade` when `start < 6`, clear it otherwise. Periods are still created only for grades 6 and up, so `recallPeriods` gets `sinceGrade: Math.max(start, 6)`.
- In `migrateTrackFromJournal`: if `earliestGrade` is set, use it as `start`.

## 2. Grid: one "Earlier" column

Add one column to the left of 6th grade in every grade grid: Shape lanes and header, the thread length bar, the Gather "Your record" panel, Plan Mode 1 bars, and the Application Prep activity page bar.

- Header label: "Earlier" (mono, same style as the other grade labels; in Shape, where grade numbers are serif 26px, use the mono label "EARLIER" aligned to the number baseline).
- Cell state: `d` (done fill) when `start < 6`, otherwise `e`. It is one cell regardless of how many years it covers.
- Leave a 3px larger gap between "Earlier" and 6th than between other columns, so it reads as a summary column.
- Update `activityStates`, `mergeStates`, `threadLengthBar` and the pitch math (`firstIdx * 59px`) for the extra column. The thread length bar's label uses `activityYears` of the longest activity, so "Since 2nd grade, still doing it" in 11th reads "10 years".
- Hide the "Earlier" column in a grid when no activity in that grid starts before 6th, so students without early activities see no change. In Shape, decide this once for the whole page so all lanes stay aligned.

## 3. Gather, question 2

"When did you start {name}?" today shows squares 6th to 11th (line ~560 in `components/ActivitiesTrackView.tsx`).

- Add an "Earlier" square before 6th, same size (56x46), label "Earlier".
- Choosing it shows a row under the squares: "About what grade?" with pills K, 1st, 2nd, 3rd, 4th, 5th. Hint: "Your best guess is fine." Nothing is preselected; "Add to my record" stays disabled until one is chosen.
- The start squares run from 6th to the current grade (`now`), not a fixed 11th, so a senior can add something started in 12th.
- The "Last grade" row for "I stopped" offers grades from the start grade through `now`. If the start is before 6th, it also offers the Earlier pills (an activity can have started and ended in elementary school).

## 4. Shape: change the years

In each Shape lane, add a third small pill "Years" next to "Move" and "Add detail". It becomes "Close" when open, like the others, and only one of the three panels is open at a time.

The panel (same `--color-surface` style as Add detail, max-width 640) contains the same controls as Gather question 2: the Earlier square, 6th through `now`, the K-5 pills when Earlier is chosen, "Still doing it" / "I stopped", and the Last grade row. Changes save immediately and the lane bar updates as the student taps.

When the years change, `applyTrackToJournal` must rebuild the journal activity's periods for the new span. Keep any existing period data (hours, weeks, role, kind) for grades that are still in the span. Today it does not update periods for an existing activity at all. Add a pure helper `rebuildPeriodsForSpan(activity, classOf, span, now)` and test it.

## 5. Sentences

- Lane hint: "{n} yrs · Since {gradeName(start)} · still doing it" or "... · through {gradeName(end)}".
- Application Prep activity summary: unchanged in what it lists (it reports grades 9-12 for the Common App), but when `start < 6`, add a second muted line: "Started in {gradeName(start)}. The Common App lists grades 9-12. Your earlier years belong in your essays."
- "Copy my notes": add "Started: {gradeName(start)}" for each activity.

## 6. Tests

In `lib/activities-track.test.ts`:

- `normalizeAct` keeps start 0-5 and still falls back to 9 for invalid values.
- `gradeName` for 0, 1, 2, 3, 4, 11.
- `activityYears`: start 2, still, now 11 → 10; start 6, stopped at 8 → 3.
- `activityStates` marks the Earlier cell done when start < 6.
- `threadLengthBar` spans from the Earlier column when the longest activity starts early.
- `applyTrackToJournal` sets and clears `earliestGrade`, and periods begin at 6th.
- `rebuildPeriodsForSpan` keeps hours and role for grades that remain and drops grades outside the span.
- `migrateTrackFromJournal` uses `earliestGrade` as `start`.

Report with screenshots of Gather question 2 with Earlier chosen, a Shape page with one early activity and one that starts in 9th (columns aligned), and the Years panel open, at desktop width and 390px.

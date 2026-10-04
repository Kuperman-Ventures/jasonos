# Activities section: build spec for Cursor

Build the **Activities** section of the college tracker as designed in this folder. Match it exactly: layout, spacing, copy and behaviour.

## What is in this folder

- `cursor-prompt.md`: this spec.
- `reference.html`: static snapshots of every component, plain HTML and CSS. Open it in a browser and compare your build against it. Use it for pixel values.
- `prototype/Activities Prototype.dc.html`: the working prototype. Open it in a browser (it needs the sibling `support.js` and `tokens.css`). The `<script type="text/x-dc">` block holds all of the logic and is plain JavaScript. Treat it as the source of truth for behaviour and copy. The template markup above it is the source of truth for dimensions.
- `prototype/tokens.css`: the app's existing token sheet. Do not restyle; use these variables.

The prototype framework (`x-dc`, `sc-for`, `sc-if`) is a prototyping runtime. Do not port it. Re-implement in the app's own stack (React suggested). The state shape, the pure functions and the copy carry over directly.

## Product principles (these shape every decision)

1. **The tool never writes for the student.** No suggested sentences, no rewriting, no scoring, no completeness percentages. "For example" lines describe kinds of answers, not answers to copy. Application Prep only gathers the student's own material.
2. **One question at a time.** Every question can be skipped. Answers save as the student types.
3. **Four stages, always visible:** 1 Gather, 2 Shape, 3 Plan, 4 Application Prep.
4. **Two different measures, drawn differently.** An *activity* bar is a row of per-grade blocks. A *thread length* is one solid orange bar with the number of years inside it. Never draw them alike.
5. Whitespace over boxes. Panels use `--color-surface` or `--color-accent-tint` fills, not borders. Thin `--color-rule` lines appear only between thread blocks and list rows.

## Tokens and type

Use only variables from `tokens.css`. Never hard-code hex.

| Role | Value |
|---|---|
| Page | `--color-bg` |
| Panels, inputs, empty grade cells | `--color-surface` |
| Raised panel (project editor) | `--color-raised` + `--shadow-sm` |
| Highlight band / selected card / new-activity block | `--color-accent-tint` |
| Past-year bar cell | `--color-accent-tint-2` |
| Current-year bar cell, primary button, thread length bar | `--color-accent` (text on it: `--text-on-accent`) |
| Planned (future) cell | hatch: `repeating-linear-gradient(135deg, transparent 0 3px, var(--color-accent-border) 3px 4px)` + `1px dashed var(--color-accent-border)` |
| Accent text | `--text-accent` |
| Done text | `--text-done` |
| Lines | `--color-border`, `--color-rule`, `--color-dash` |

Fonts (load from Google Fonts):
- **Archivo** 400/500/600/700: UI, body, buttons, page title (34px / 700 / -0.02em).
- **Source Serif 4** (`.ser`, weight 400, letter-spacing -0.01em): section headings (40px), thread names (28px), questions (24–34px), numerals.
- **IBM Plex Mono** (`.m`): 11px, uppercase, letter-spacing .16em, `--text-subtle`. Labels, counters, status.

Icons: Phosphor (`@phosphor-icons/web`, class `ph ph-<name>`), regular weight.

Shared primitives (exact CSS is in `reference.html`):
- **Pill** (`.pill`): 32px high, 15px side padding, radius 16, 1px `--color-border`. Selected = `--color-text` background, `--color-bg` text. Sizes: `sm` 28px/13px, `xs` 26px/12px.
- **Primary button** (`.btn`): 42px, radius 3, accent fill, 600 15px. Hover `--color-accent-pressed`. Disabled 40% opacity. `.sm` is 34px/14px.
- **Secondary button** (`.btn2`): same size, 1px border, transparent.
- **Underline input** (`.ul`): no box, 2px bottom border `--color-text`, focus border `--color-accent`. Used for all text entry.
- **Inline-edit input** (`.nm`): looks like text, 1px bottom border appears on hover/focus.
- **Tab** (`.tab`): mono 11px uppercase; active = `--text-accent` + `inset 0 -2px 0 var(--color-accent)`.
- Links: `--text-accent`, underline 1px, offset 2px; hover `--color-accent-pressed`.
- Focus: `:focus-visible` 2px `--color-accent` outline (already in `tokens.css`).

## Data model

```ts
type Activity = {
  id: string; name: string;
  thread: string | null;        // thread id; null = "Not in a thread"
  start: number;                // grade 6..11
  still: boolean;               // still doing it
  end: number;                  // last grade if !still; else current grade (11)
  type: 'other'|'arts'|'sport'|'eng'|'work'|'service'|'family'|'project';
  answers: Record<string,string>; // question id -> student's text
  // Application Prep facts
  role: string; org: string; desc: string;   // desc = "Your notes", max 150
  hours: string; weeks: string; college: ''|'yes'|'no';
  status: 'draft'|'ready';      // UI words: "In progress" / "Prepared"
};
type Thread = { id: string; name: string };
type PlanStep = { id: string; actId: string; year: 11|12; lens: string; text: string };
type Intents = Record<`${actId}:${11|12}`, 'keep'|'up'|'finish'>;
type Project = { id: string; title: string; partner: string; outcome: string; when: ''|'11'|'12'; why: string };
```

Constants: `GR = [6..12]`, current grade `NOW = 11`. Make `NOW` come from the student's profile.

Icons are **chosen by AI from the activity name** in the real system. The prototype uses a keyword stand-in (`iconOf`). Replace it with the real service; cache the result on the activity and re-run on rename.

## Derived state (pure functions, port as-is)

`states(activity, steps, intents)` returns 7 codes, one per grade 6..12:
- `e` empty: grade < start, or after `end` when stopped.
- `d` done: start..10 (and up to `end` when stopped).
- `n` now: grade 11 when still doing it.
- `p` planned: grade 12 only when still doing it **and** intent for 12 is not `finish` **and** (an intent for 12 exists or a step exists for year 12).

`merge(listOfStates)`: per grade, highest priority wins (`n` > `d` > `p` > `e`).
`years(states)`: count of `d` + `n`.

**Thread length** = years of the thread's **longest activity** (not the union). Draw it as an orange bar aligned to the grade columns, spanning that activity's first to last done/now grade: `margin-left = firstIdx * 59px`, `width = (lastIdx - firstIdx + 1) * 59 - 3px` (56px cell + 3px gap). Label inside: `"6 years"`. Placed above the activity bars, on the same row as the thread title.

## Navigation

Header: title "Activities" (34/700). Top-right links: "How this works" / "Hide how this works" (the explainer is **collapsed by default**) and "Reset demo" (prototype only; drop it).

Explainer: 4 columns (`repeat(auto-fit, minmax(210px, 1fr))`, gap 12). Each column: numeral (serif 30), a small illustration of that stage, title (serif 20), goal (15px), note (hint). The active stage has `--color-accent-tint` and `inset 0 3px 0 accent`; inactive columns have `inset 0 1px 0 var(--color-border)`. No "You are here" text. Columns navigate to their stage. Illustrations are in `reference.html` section 01.

Stage tabs below it: `1 Gather`, `2 Shape`, `3 Plan`, `4 Application Prep`. A check mark is appended to **Shape** when nothing is unassigned, **Plan** when there is any rest-of-high-school choice and at least one project, **Application Prep** when every activity is Prepared.

Default landing view: Plan. Application Prep has a list view and an activity view.

## Stage 1: Gather

Purpose: fast intake. Three questions, one at a time, with a "Your record" panel on the right (grid `1fr 360px`, gap 56). Skipping is always possible ("Skip the questions and shape my threads").

1. "What do you do that takes regular time, in school or out?" (hint: "For example: an instrument, a sport, a club, a job, caring for family."). Underline input 20px + Next (disabled until text).
2. "When did you start {name}?" (hint: "Your best guess is fine."). Grade squares 6th to 11th (56x46), then "Still doing it" / "I stopped" pills; if stopped, a "Last grade" row (56x40).
3. "Which thread does it belong to?" (hint: "A thread groups things that belong together, like everything you do with music."). Pills: existing threads, "A new thread" (reveals a name input), "Decide later". Button "Add to my record".

On add: toast "{name} added", reset to question 1, and the new activity's block in the right panel gets `--color-accent-tint` and a "· new" tag.

"Your record" panel: grade header in mono (24px columns, current grade labelled "11 now" in accent), then per thread: serif 20px name with the thread's longest activity length as mono text on the right ("6 yrs"), then one 6px-tall bar per activity (24px cells) with icon + name below. No thread length bar in this panel.

Ask nothing else in Gather. Deeper questions belong to Shape.

## Stage 2: Shape

Purpose: arrange threads, and flesh out each activity.

Layout: grid `260px 1fr`, gap 28. Header row: grade numbers at 56px columns, serif 26px / 600; current grade in `--text-accent` with a mono "NOW" below. Each block is a grid `260px 1fr`, padding `24px 12px`, margin `0 -12px`, `border-top: 1px solid var(--color-rule)`.

Left column of a thread block: serif 28px name (plain text), hint "{n} activities", link "Edit thread". Edit opens a `--color-surface` panel with a name input, the note "Removing a thread keeps all its activities. They simply stay unassigned.", `Remove thread` (secondary) and `Done` (primary). Removing a thread **never deletes activities**; they move to "Not in a thread".

Right column: thread length bar (above), then one **lane** per activity:
- 12px-tall bar, cells 56px wide, gap 3.
- Row beneath: icon (24px, `--text-accent`), inline-editable name (16/600), hint `"{n} yrs · Since {start}th grade · still doing it"` (or `"through {end}th"`), then two small pills on the right: **Move** and **Add detail** (the label becomes `Add detail · {n} answered` once any answer exists; both become **Close** when open).
- Move opens a row: "Move to" + pills for every other thread, "No thread" (if currently in one) and "+ New thread" (creates "New thread" and moves the activity in).

"Not in a thread" block (shown only when non-empty): same structure, tinted `--color-accent-tint`, title in `--text-muted`, no length bar, no Edit link.

Footer row (dashed top border): `+ New thread` (secondary), link `+ Add an activity` (goes to Gather), spacer, `Continue to Plan` (primary).

### Add detail panel

Opens under the lane. `--color-surface`, padding `22px 24px`, max-width 640. Contents top to bottom:
1. **Dropdown** (native `<select>`, 32px high): label "Add extra questions about". Options: Nothing in particular, Performing or creating, Sports and training, Building or designing, Working a job, Helping others, Caring for family, Starting something of my own. This controls the "A few more" group only. It does not affect the icon or the thread. Avoid the word "kind" or any term that sounds like a thread name.
2. **Group tabs with dots.** One tab per question group (mono 10px). Beneath each tab, one 10px dot per question in that group: outlined = unanswered, accent-filled = answered, current question = extra ring (`0 0 0 2px var(--color-bg), 0 0 0 3px var(--color-text)`). Tabs and dots are clickable. Never show a count or percent.
3. "Question {i} of {n}" (mono, accent).
4. Question text (serif 24), then `For example: {ex}` (hint).
5. Textarea (3 rows, underline style), placeholder "A phrase is fine. You can come back to it."
6. Nudge line (accent text) with a "Dismiss" link, when present.
7. Buttons: primary label is `Skip` (empty answer), `Next`, `Continue anyway` (a nudge is showing) or `Done` (last question); `← Back`; right-aligned hint "Saves as you type. Every question can be skipped."

**Nudges** (simple rules, no AI; show only when the student presses Next, once per answer, never block):
- Uses we/our/us and none of I/my/me: "What was your part?"
- Contains passionate, learned a lot, hard work, teamwork or leadership skills: "What is a specific example?"
- Group "What changed" and the answer has no digit: "Any numbers? A placement, a count, a score, a time."
- Under 8 words (except the "Any numbers?" question): "Can you say more? What did that look like?"

If a nudge is shown, the first Next press displays it; the second press continues.

### Question bank

Group order and ids (copy verbatim; `ex` is the "For example" text). Ids are the keys of `answers`.

**What you do**
- `week` Walk through a typical week. What do you actually do? / Rehearse, practice drills, build and test, run a meeting, train newer members.
- `resp` What are you responsible for that would not happen without you? / A section, a piece of equipment, a schedule, a set of customers, a younger sibling's pickup.
- `with` Who do you work with, and what is your part? / The size of the group and the specific job that is yours in it.

**What changed**
- `diff` What is different because you were there? / A result, a fix, a new member who stayed, an event that ran better.
- `nums` Any numbers? / A placement, a score, a record, how many people, how much money, how many hours.
- `helped` Who did it help, and how? / Teammates, younger students, customers, your family, a community group.

**A few more** (by dropdown choice; ids `type0`, `type1`)
- Performing or creating: What is the hardest piece or part you have performed? / A piece, a role or a performance that stretched you. — Any auditions, chairs, solos or ensembles you earned a place in? / A placement, a chair, a solo, an ensemble you auditioned for.
- Sports and training: What level, rank or belt have you reached, and when? / A belt, rank, level or team, and the year you got there. — What is a result you are proud of? / A placement, a record, a game, a personal best.
- Building or designing: What part of the build or design was yours? / A subsystem, a design decision, a piece of code or hardware. — What did you test, and what did you change after testing? / A test that failed and the change you made next.
- Working a job: What do you do that your manager relies on you for? / A task, a shift, a responsibility that is handed to you. — Any raise, promotion or added responsibility? / A raise, a new title, a new task you were trusted with.
- Helping others: Who did your work help, and how many? / The people or groups it reached, and roughly how many. — What would not have happened without the group's work? / An event or service that needed the group to run.
- Caring for family: What do you take care of, and how many hours a week? / A sibling, meals, translating, a family business. — What would your family do without it? / What would be harder or left undone.
- Starting something of my own: What made you start it? / A problem you noticed, something missing, a person who inspired you. — Who said yes, and how did you get them to? / A partner, a venue, a sponsor, and how you asked.

**Growth** (only when the activity spans 2+ years; ids `g1`..`g4`)
- How is what you do now different from your first year? / More responsibility, harder music, a bigger role, teaching instead of learning.
- What can you do now that you could not when you started? / A skill, a technique, a level, a kind of problem you can solve.
- What is the hardest thing you have done in this activity? / A competition, a failure you recovered from, a deadline, a difficult piece or build.
- Tell about a time something went wrong. What did you do? / A broken part before a competition, a missed cue, a conflict on the team.

**Things you started** (`s1`, `s2`)
- Did you start, fix, organize or change anything here? / A new practice routine, a fundraiser, a tool, a way of doing things that stuck.
- Have you taught or helped anyone newer than you? / A newer member, a new hire, a teammate or a younger student.

**Why it matters** (`m1`..`m6`; `m2` only for 3+ years)
- `m1` Why does this matter to you? / What you get from it that you do not get anywhere else.
- `m2` Why have you kept doing it? / What made you stay when you could have quit.
- `m3` What have you gotten better at? / Skills, habits, how you work with people.
- `m4` How have you changed since you started? / How you think, act or see yourself differently.
- `m5` What is one moment you remember? / A specific day, performance, game, build or conversation.
- `m6` Does this connect to what you want to study or do? / A skill, interest or question that carries into your intended major.

Not built yet (from the original prompts doc): Looking Ahead questions beyond Plan, moments, award creation, monthly check-in nudges, the "3+ years and Growth is empty" nudge.

## Stage 3: Plan

Top: a **Next band** (`--color-accent-tint`, padding 22 26, copy in mono + serif 24 + primary button). Its text is chosen in this order:
1. Any unassigned activity: "Next · Shape" / "{name} is not in a thread yet. Where does it belong?" / Shape.
2. No rest-of-high-school choices: "Next · The rest of high school" / "Choose what you want to do with each activity in 11th and 12th grade." / Plan it.
3. No project ideas: "Next · A project of your own" / "Is there something you could start yourself, with a partner outside school?" / Think about it.
4. Any activity not Prepared: "Next · Application Prep" / "{n} activities still need notes gathered." / Application Prep.
5. Otherwise: "Done for now" / "Your plan is made and your notes are gathered." / Copy my notes.

Below it, **two large mode cards** side by side (`repeat(auto-fit, minmax(340px, 1fr))`, gap 20). Plan is two different planning modes and must read that way.

| | Mode 1 | Mode 2 |
|---|---|---|
| Kicker | Mode 1 · What you already do | Mode 2 · Something new |
| Title (serif 28) | The rest of high school | A project of your own |
| Sub | Decide what to do with each of your activities in 11th and 12th grade. | Start something yourself, with a partner outside your school. |
| Status | "Not started" / "{n} choice(s) made" | "No ideas yet" / "{n} idea(s)" |
| Sketch | two ribbons + Keep going / Step up / Finish pills | dashed Idea → Partner → Result chain |

Selected card: `--color-accent-tint` and `inset 0 4px 0 var(--color-accent)`. Unselected: transparent and `inset 0 1px 0 var(--color-border)`. The kicker and status row wraps with a 16px gap.

### Mode 1: The rest of high school

Mono label "Mode 1 · What you already do", serif 40 heading, intro "You have this year and senior year. For each activity, choose what you want to do in each year. If you keep going or step up, add steps that would make it stronger."

A row per activity (grid `260px 1fr 1fr`, gap 26): icon + name + thread hint + a small 20px-cell bar on the left, then a cell for 11th grade ("now") and for 12th grade.

Each cell:
- Three pills: **Keep going / Step up / Finish**. Clicking the active pill clears it. The choice sets the senior-year bar (planned hatch unless Finish).
- Added steps, each `{label} {text} ×`.
- With no choice: hint "Choose one to add steps".
- With a choice: link "+ Add a step", which opens an inline composer **inside that cell** (activity and year are already known). Its prompts depend on the choice, so the three choices are substantively different:

| Choice | Composer label | Prompts (pill → question → example) |
|---|---|---|
| Keep going | Keeping going | **Stay consistent**: What will help you keep this going at the same level? / A schedule, a practice routine, a way to balance it with other commitments. **Keep it fresh**: What would keep it interesting for another year? / A new piece, a new part of the work, a different role on the team. **Watch out for**: What could get in the way, and how could you handle it? / A heavier course load, a schedule conflict, losing motivation. |
| Step up | Stepping up | **Go deeper**: How could you go deeper in this? / For example: a harder level, a competition, a longer commitment. **Lead**: What role could you take on, or who could you teach? / For example: section leader, or teaching younger members what you wish you had known. **Outside school**: Where could you do this beyond school? / For example: a community group, a summer program, a local employer. **Make something**: What could you build, record or show? / For example: a project, a performance, a portfolio piece. **Connect**: Who could you work with that you do not know yet? / For example: a mentor, another school, a professional in the field. |
| Finish | Finishing | **End well**: What do you want to have done before you finish? / A last performance, a final project, a goodbye to your team. **Hand it on**: Who could take over what you do, and how could you help them? / Training a younger member, writing down how you run things. **Carry it forward**: What from this will you take into other things? / A skill, a habit, a connection that stays after you stop. **Why finish**: Why are you choosing to finish? / A new priority, a time limit, a goal you reached. |

Composer: `--color-surface` panel, mono label, prompt pills (`xs`), serif 18 question, hint example, underline input "Write your idea", `Add step` (disabled while empty) and `Cancel`. Steps added under one choice stay listed if the choice later changes.

### Mode 2: A project of your own

Rendered on a `--color-raised` panel with `--shadow-sm`, padding `30px 34px 36px`, so it looks different from Mode 1. Mono label "Mode 2 · Something new", heading "A project of your own", intro: "Colleges notice what you start, not only what you join. A self-started project is something you organize yourself, with a partner outside your school. It can come from anything you care about."

Grid `280px 1fr`, gap 48:
- Left: "Your ideas" list (selected = `--color-accent-tint`), `+ New idea`, and "Not sure where to start?" with starter links built from the student's thread names: "Teach a younger group what you know about {thread}", "Make something in {thread} and show it publicly", "Start a small service or event for your community", "Organize a drive or fundraiser with a local group". Clicking a starter creates an idea with that title.
- Right editor (max 640): "The idea in a few words"; "Who outside your school could be your partner?" (placeholder: A library, a business, a nonprofit, a mentor); "What will exist at the end, and who will see it?" (placeholder: A workshop, a show, a website, a donation total); "When could you do it?" pills `This year (11th)` / `Senior year (12th)`; "Why does it matter to you?" (textarea, "In your own words"); a 44px-cell bar showing the chosen grade as planned; "{n} of 4 parts filled in" and "Remove this idea". (The 4 counted parts are idea, partner, outcome, when.)

## Stage 4: Application Prep

Purpose: **help the student gather their own material in one place**. Never imply the tool writes applications. Page heading "Application Prep". Intro: "{n} of {total} activities prepared. Gather what you have built here so it is on hand when you fill out your applications. Everything is your own words and facts. Nothing here is written for you." Top-right button: "Copy my notes" (copies each activity's role, organisation and notes as plain text, in the student's order).

List (max-width 780): rows `24px 1fr 60px 110px 74px` = number, icon + name + thread, up/down reorder buttons (28px), status (mono: "Prepared" in `--text-done`, "In progress" in `--text-subtle`), "Open". Order is the student's own.

Activity page: back link "← Application Prep"; mono "Activity {i} of {n} · {status}"; 44px serif heading with a 40px icon; summary line like "9th–11th grade, 8 hours a week, 36 weeks a year." Then:
- Hours a week, Weeks a year (digits only; editing either resets status to In progress).
- Position or leadership (max 50, counter).
- Organization (max 100, counter).
- **Your notes** (max 150, counter turns accent at 140+). Placeholder: "Jot down what you do, how often, and what you are responsible for. You will write your own version when you apply."
- A `--color-surface` reference box "From your plan and notes, for reference" listing, as the student's own words: plan steps (`{label} · {year}th`) and every answered Shape question (`{group} ·`). Read-only. Never generated text.
- "Do you plan to do this in college?" Yes / No pills.
- Primary button "Mark as prepared" (disabled until hours, weeks and notes exist; hint "Still needs weeks a year, some notes."). Once prepared it reads "Prepared. Mark as in progress". Marking prepared advances to the next unprepared activity with the toast "Prepared. On to {name}."

## Copy and tone rules

- Never use: "write up", "draft", "we'll write", "suggested", "improve", "score".
- Use: gather, prepare, notes, "your own words".
- Toasts (bottom-center, dark pill, 2.2s): "{name} added", "{name} moved to {thread}", "New thread created. Type to rename it.", "New thread added. Type to rename it.", "{thread} removed. Its activities are loose.", "Step added", "Saved to {name}", "Copied your notes", "Idea removed".

## Backend / integration notes

- Persist `Activity`, `Thread`, `PlanStep`, `Intents` and `Project` per student. `answers` autosaves on every keystroke (debounce 400ms).
- Icon: call the existing AI icon service with the activity name; store the icon id; refresh on rename.
- "Continue in college" (Yes/No) feeds the Common App field of the same name.
- The prototype keeps all state in memory and has a "Reset demo" link; do not ship those.

## Acceptance checklist

1. Four stage tabs; explainer collapsed by default; active explainer column tinted with the top bar and no "You are here" text.
2. Gather asks 3 questions, adds to the "Your record" panel, highlights the new block.
3. Shape: big grade numbers; thread length is an orange bar with years inside, over the activity bars, and equals the longest activity; each activity has icon, name, years, Move, Add detail.
4. Edit thread renames or removes; removing never deletes activities.
5. Add detail: dropdown for extra questions, group tabs with per-question dots (no counts), one question at a time, skip always works, nudges once and dismissible.
6. Plan: two prominent mode cards; Mode 2 sits on a raised panel; each of Keep going / Step up / Finish opens a different prompt set inside its own cell.
7. Application Prep: gathering language only, notes limited to 150, reference box shows the student's own words, nothing generated.
8. Layout holds down to about 760px wide: explainer and mode cards wrap; Shape lane controls do not break onto stray lines.
9. All colours and fonts come from `tokens.css` and the three font families; dark mode works through `data-mode="dark"`.

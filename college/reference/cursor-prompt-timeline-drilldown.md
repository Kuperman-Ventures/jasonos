# Cursor prompt — Timeline: click a bar to open its stage Gantt

Attach with this prompt:

- `timeline-drilldown.html` — working reference (light + dark, sample data)
- `tokens.css` — College Launch Plan color tokens, light + dark
- `the-track-design-guidelines.md` — site-wide style guide
- `design-guidelines.md` — rules specific to this view

---

## Prompt

> On Project Management → Timeline, make every bar on the main Gantt clickable. Clicking a bar opens a large modal that charts that project's stages as a second Gantt. Use `timeline-drilldown.html` as the reference: match its layout, geometry and class names. Colors come only from `tokens.css` plus the chart tokens at the top of the example's `<style>` block (`--bar`, `--bar-future`, `--milestone`, `--milestone-ink`, `--now-band`, `--gridline`). Add those chart tokens to `tokens.css`.
>
> **Main timeline (existing view).** Leave the layout as it is. Each bar or phase segment becomes a `<button>` whose accessible name gives the project, phase, dates, status and "open stages". "Complete college list" keeps its three phase segments (Explore, Consider, Apply). Clicking any of them opens the same project. The hover state stays as it is now.
>
> **Modal.**
> - Header: a mono kicker ("Sep 2026 – Aug 2027 · 1 of 7"), the project name as the title, and a summary line ("11 stages · 1 done · 2 in progress · 8 not started"). Milestones don't count toward the stage totals.
> - Actions: previous / next project, and close. ← and → do the same from the keyboard, and Esc closes. Clicking the backdrop closes. Focus moves into the dialog on open, is trapped while it's open, and returns to the bar that opened it.
> - Stage chart: columns are stage name (280px), dates in mono (120px), then the time track. The time track runs from the first of the project's start month to the end of its end month. Projects of two months or less switch to week ticks. A final partial week shorter than 4 days merges into the week before it.
> - When a project has phases, its stages sit under phase headings in mono caps.
> - Status comes from dates and today: done if the end is before today, in progress if the start is on or before today, otherwise not started. Done = `--color-done`, in progress = `--bar`, not started = `--bar-future`. A text mark (✓ ● ○) also shows status, so color is never the only signal.
> - Deadlines are magenta diamonds (`--milestone`). Their names use `--milestone-ink`.
> - A 2px orange now-line with a "NOW" cap appears only when today falls within the project's range. It is the only orange in the modal.
> - Footer: the legend and an "Open in To-dos →" link that goes to To-dos filtered to this project.
>
> **Data (required, not in the app yet).** The app only stores the 7 top-level projects with start and end months. Stages need a new model:
>
> ```
> Project { id, name, start, end, phases?: [{ name, start, end }] }
> Stage   { id, projectId, name, start, end, phase?, isMilestone, completedAt? }
> ```
>
> For a milestone, `start = end`. If `completedAt` is set, it overrides the date-derived status and the stage shows as done. The simplest path is to add `projectId` and a start date to To-do subtasks, so the modal and the To-dos tab read one source. The stages in the example are placeholders. Replace them with real records and don't ship the sample stages.
>
> **Non-negotiables.** Tokens only. Archivo for names, IBM Plex Mono with `tabular-nums` for every date and tick. No text inside modal bars. Radius 1–4px. `:focus-visible` is the 2px accent ring. Check light and dark mode at 1440px, 1000px and 375px (both charts scroll horizontally below their min-width).

---

## What to check on the result

- Every bar and segment on the main timeline opens the modal for the correct project.
- Esc, the backdrop, ← and → all work, and focus returns to the bar that opened the modal.
- The essays project shows week ticks, and no tick label wraps or clips.
- The NOW cap never overlaps a month label.
- Stage bars start and end on the correct days (check one mid-month stage with devtools).
- In dark mode, nothing is left as a hard-coded light color.

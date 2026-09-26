# Cursor prompt — The Track timeline (dense ledger, month resolution)

Attach with this prompt:

- `design-guidelines.md` — the design system
- `examples/timeline-dense-ledger.html` — a working reference implementation
- `cursor-prompt-left-rail.md` — the shell this view sits inside

---

## Prompt

> Rebuild the Timeline view as a dense month-resolution ledger. Use the attached `design-guidelines.md` as the binding source of truth for color, type and spacing, and `examples/timeline-dense-ledger.html` as the reference implementation — match its grid math, token names and class names rather than inventing new ones. The task data, dates and milestone stay exactly as they are; this is a layout change.
>
> **The problem to fix.** The current chart draws each task as a wide arrow with its name set inside the bar, which forces every row to roughly 100px tall and pushes seven tasks past 1,100px of height while the right third of the sheet stays empty. Move the names out of the bars and the rows collapse to 34px.
>
> **Structure.** One CSS grid, no nested per-row grids and no absolute positioning for bars:
>
> ```
> grid-template-columns: var(--label-w) var(--span-w) repeat(var(--months), minmax(var(--month-min), 1fr));
> ```
>
> Column 1 is the task name, column 2 is the date span in mono, and the months start at column 3. A task beginning at month index `S` (0 = Sep 2026) and lasting `L` months is placed with `grid-column: calc(3 + S) / span L`. Compute those two numbers from the real start and end dates — do not hard-code the literals in the example. The months window is driven by `--months`; widening the range is a token change, not a layout change.
>
> **Time scale.** Two header rows: year bands (2026 / 2027 / 2028) above three-letter month abbreviations. January and the other quarter-opening months (Jan, Apr, Jul, Oct) are set in `--text-muted` at weight 600 so the quarters stay legible when the months compress; the rest are `--text-subtle`. A single `repeating-linear-gradient` layer spanning `grid-column: 3 / -1` draws the month hairlines behind every row — never one border per cell.
>
> **Rows.** 34px tall, 16px bars, one hairline rule beneath each. Names are Archivo 15px, truncated with an ellipsis rather than wrapped, so row height never varies. The span text ("Sep – Mar") is IBM Plex Mono with `tabular-nums`. Bars carry no text at all — the full name, dates and status live in a `title` and should also be available on click.
>
> **Marks.**
> - The "you are here" marker is a 2px `--accent-500` vertical rule spanning the header and every row, placed by grid column at the current month, with a small mono "NOW" cap above the scale. Orange appears nowhere else in the chart.
> - Milestones are magenta diamonds on their own 34px row, not bars — the essays milestone sits at Jul 2027.
> - Tasks that have not started take the pale `--bar-future` blue and a `--text-subtle` name.
>
> **Scrolling and responsiveness.** The grid sits in a horizontally scrolling wrapper with `min-width` derived from `--month-min`, so months compress to a floor and then scroll rather than squeezing to nothing. Below 900px the span column is hidden and the label column narrows to 180px; the name column stays visible at all widths. Do not add a vertical scroll area — the whole point is that the chart now fits.
>
> **Non-negotiables from the design system.**
> - Only tokens: no hard-coded hex, font name or px value that a token already carries.
> - Exactly one orange element in the view: the now marker. Task bars are blue; the milestone is the single magenta.
> - No cards, boxes or section dividers — whitespace and the row hairlines do the organising.
> - Archivo for task names, IBM Plex Mono `tabular-nums` for every date, month label and span.
> - Radius stays 1–4px; no pills, no arrowheads on bars.
> - `:focus-visible` is a 2px `--accent-500` outline at 2px offset; bars are keyboard-reachable if they are clickable.
>
> **Accessibility.** Bars are not decorative: each needs an accessible name carrying task, start, end and status. Color alone must not distinguish "not started" — the pale bars also carry their state in that accessible name. Verify in both light and dark mode at 1440px, 1000px and 375px.

---

## What to check on the result

- Seven tasks plus the milestone fit in roughly 300px of height.
- No text sits inside a bar.
- Month hairlines come from one background layer, not per-cell borders.
- Bar start and end land on the correct month columns at every width.
- Exactly one orange thing on screen.
- Every bar has an accessible name with its dates and status.

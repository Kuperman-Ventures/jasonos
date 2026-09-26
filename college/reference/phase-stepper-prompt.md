# Cursor prompt — College list phase stepper (calendar bar, fused span)

Replace the three phase buttons at the top of the College list dashboard (Exploration / Consideration / Applications) with a calendar-bar stepper, and give each phase its own page color. Reference implementation: `phase-stepper.html` in this folder — match it exactly. Follow `design-guidelines.md` for tokens, type and states.

## What it is

The three phases are one sequential process, so the stepper is drawn as a single timeline split into three spans. Each span's width matches the phase's real length on the calendar (Sep–Dec, Jan–Jul, Aug onward). Clicking a span shows that phase's list. The step you are viewing opens into the page below it: its column takes the phase's page color and runs straight into the body, like a tab.

## Two separate states — never merge them

- **Now** (time-based, from today's date): orange `NOW` tag next to "Step N", a `TODAY · SEP 25` marker above the bar at today's position, and an orange fill on the bar up to today. Earlier phases are filled completely.
- **Viewing** (user selection): the column background takes that step's own page color, gets a 3px `--color-text` top rule, the bar grows from 6px to 12px, and the name goes from `--text-muted` to `--color-text`. Use `aria-current="step"`.

A phase can be both. Default the view to the current phase on first load (the example opens on Consideration only to show both states at once).

## Colors — 2c "Deepening paper"

The header (title, readout, stepper) stays on `--color-bg` paper. The page body below the stepper takes the viewed phase's color. Set `data-phase` on the page root and read these tokens:

| Phase | Page bg | Surface (table head, inputs) | Track | Span tone |
| --- | --- | --- | --- | --- |
| Exploration | `#f3f2f2` | `#e8e6e5` | `#d7d3d3` | `#bab6b6` |
| Consideration | `#e7e5e2` | `#dbd8d4` | `#c5c1bc` | `#a8a39d` |
| Applications | `#d6d9dc` | `#c9cdd1` | `#b0b5bb` | `#8f969e` |

- Span tones are fixed per step and don't change with the viewed phase. The bar gets darker left to right.
- On Applications, use muted text `#3a3838` and subtle text `#4f4d4d` so small mono labels stay above 4.5:1.
- Orange stays the only accent in every phase. Don't tint grounds orange, and don't touch the selectivity tier hues.
- Background change: `transition: background .35s`.

## Also fix

- The eyebrow must follow the viewed phase: `Phase 2 of 3 · Junior spring`. It currently always says Phase 1.
- The readout label follows the view: `CONSIDERATION LIST`.

## Layout and type

- Grid: `grid-template-columns` in `fr` proportional to phase length in days, 6px gap. Each step's column: 6px/18px/26px padding. Each column stacks: a 34px today slot, a 12px bar slot, `STEP N` label (mono 11/0.16em uppercase), name (Archivo 22/600), meta `dates · have / target schools` (mono 13).
- The header has no bottom padding, so the viewed column meets the body with no gap. Every step button must fill its grid cell (`height: 100%`, `li` as flex). Otherwise, when one step's meta wraps to two lines, the viewed column comes out shorter and leaves a strip of paper above the body.

## Interaction

- Steps are `<button>`s inside an `<ol>`. Hover: the step's own page color at 55%. Focus: 2px accent `:focus-visible` outline, 2px offset. Left/Right arrow keys move the view.
- Touch targets are the full column (well over 44px).

## Don't

- Don't add boxes, borders or cards around the stepper.
- Don't use chevrons, circles or tabs in addition to it. The bar is the entire control.
- Don't animate the bar on load.

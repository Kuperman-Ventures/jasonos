# Design guidelines — Timeline stage drill-down

Follow `the-track-design-guidelines.md` for everything site-wide. This file covers only what's specific to this view.

**Hierarchy.** The main timeline is the overview and the modal is the detail. The modal uses the same visual grammar as the main chart: hairline rows, mono dates, blue bars and one orange now-line. Nothing inside it is boxed.

**Color roles in the chart**
- `--bar`: in progress
- `--bar-future`: not started (the stage name also drops to `--text-subtle`)
- `--color-done`: done. This appears only in the modal. The main chart has no finished projects yet, and when it does they should use the same token.
- `--milestone`: deadline diamonds. This is the only magenta on screen.
- `--color-accent`: the now-line and its cap. This is the only orange on screen, apart from the bar hover state.

**Type.** Project and stage names are Archivo (16px on the main chart, 15px in the modal). The modal title is Archivo 30px/700. Kickers, ticks, date spans, summaries and legends are IBM Plex Mono (10–12px) with tabular numbers.

**Geometry.** Main rows are 39px with 17px bars. Modal rows are 36px with 16px bars and 12px diamonds. The modal is at most 1180px wide and sits 6vh from the top on `--backdrop`, with `--shadow-lg`.

**Scale.** The main chart shows Sep 2026 – Jan 2028 at month resolution. The modal chart covers only the project's own range: months, or weeks when the project lasts two months or less.

**Status is never color alone.** Each stage row carries a ✓ ● ○ ◆ mark, and every bar has an accessible name with the stage, its dates and its status.

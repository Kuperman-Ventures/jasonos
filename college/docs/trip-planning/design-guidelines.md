# Trip planning: design guidelines

Tokens come from `tokens.css`; site-wide rules from `the-track-design-guidelines.md`. This file covers only the Trip planning tab.

## Shared
- Kicker: 24px square school mark + name 16/700 + `TRIP PLANNING` mono label.
- Sub-tabs: underline style, 28px gap, same as Project Management.
- Headings in panels: 22/700, −0.01em. Meta line 14 muted.
- Interest is always the `--lvl-*` fill with its `-fg` label; "Not on list" is a dashed outline. The school being viewed is an ink ring (`0 0 0 2px bg, 0 0 0 4px ink`), never a different fill.
- The one orange in maps is the active route. Everything else on a map is ink, neutral or interest blue.

## Maps
| Element | Light | Dark |
| --- | --- | --- |
| Tile filter | `grayscale(1) contrast(.82) brightness(1.1)` | `grayscale(1) invert(1) contrast(.8) brightness(.85)` |
| Pin border | `--color-bg` | `--color-bg` |
| Inactive route | ink 2px, 35%, dash 4 6 | same, dark ink |
| Active route | `#e85504` 4px solid | same |
| Leg label | ink chip, bg-colored mono 11 | same (flips) |
| US land | `--color-raised` | `--color-raised` |
| Neighbors | `--color-surface-2` | `--color-surface-2` |
| Region fill | `rgba(32,30,29,.035)` | `rgba(240,238,236,.04)` |
| Region fill, hover | `rgba(232,85,4,.07)` | `rgba(232,85,4,.12)` |
| Region stroke | 1px dashed `--text-subtle`; hover 1.5px solid ink | same |

Pin: 26px tall, 3px radius, 2px border, mark 11/800. Keep pins ≥ 34px apart on screen; nudge campuses that share a block.

## When to go
| Cell | Style |
| --- | --- |
| Kyle break | solid accent, `--text-on-accent` 700 |
| Kyle school / campus classes | `--color-surface`, subtle text |
| Campus break | 1px dashed `--color-dash`, muted 600 |
| Campus finals | stripes `--color-accent-tint-2` / `--color-accent-tint`, 5px, `--text-on-tint` |
| Selected column | inset 2px ink ring; header filled ink |
| Best fit | header sub-label in `--text-accent` 600 |

Row height 40px, 4px gaps, 170px label column.

## Itinerary
- Slot: 52px mono time column; box min 40px, 8/12 padding.
- School stop on `--color-surface`; current school in `--color-accent-tint` with `--color-accent-border`.
- Drive/meal: transparent, 1px dashed `--color-border`, mono 10 kind label.
- Conflict banner: `--color-accent-tint`, `--text-on-tint`, link in `--text-accent`.

## Climate
- 15–95°F scale over 220px; gridlines `--color-rule`.
- Primary range bar `--color-accent`; comparison bar 1.5px ink outline. Rain `--lvl-3`; comparison rain outline.
- School-year band: `--color-accent-tint` under Sep–May.
- Months ordered Aug → Jul.

## Accessibility
- Every pin, dot and composition segment carries a `title` with the school name and interest level.
- Cluster cards are focusable; Enter/Space activates.
- Week cells are buttons or have `role="button"`; the selected week is announced.
- Maps are supplementary: every fact on a map (clusters, regions, counts) is also in the adjacent list.

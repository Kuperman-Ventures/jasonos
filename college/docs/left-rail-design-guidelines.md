# Left rail: design guidelines

Project-wide tokens, type and dark mode are in `the-track-design-guidelines.md`. This file covers the rail only.

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--rail` | `#eae9e9` | `#16181b` | Rail background |
| `--card` | `#f3f2f2` | `#1f2228` | Phase card |
| `--hover` | `#e0dede` | `#2d3139` | Item hover, open account row |
| `--menu` | `#ffffff` | `#2d3139` | Account menu |
| `--line` | `#d7d3d3` | `#3d424b` | Empty phase segments |
| `--ink` / `--subtle` | `#201e1d` / `#605d5d` | `#f0eeec` / `#9aa0a8` | Labels / icons, counts, group labels |
| `--tint` / `--on-tint` | `#feeee4` / `#461a05` | `#3b2317` / `#fdd6c0` | Active item, selected role |
| `--icon-on` | `#c74503` | `#fab48e` | Active item icon |
| `--accent` | `#e85504` | `#e85504` | Filled phase segments |
| `--brand` | `#2f5aa0` | `#7ba4ee` | Brand cap icon |
| `--avatar-bg` / `--avatar-ink` | `#d3dcea` / `#2f5aa0` | `#26344d` / `#a9c1ec` | Initial avatar |

In dark, the rail sits one step darker than the page (`#16181b` vs `#1f2228`), so the content area reads as the raised surface.

## Type

| Element | Spec |
| --- | --- |
| Household name | Archivo 17 / 700 |
| Student line, next phase | 13, subtle |
| Phase name | 15 / 600 |
| Phase fraction, counts | IBM Plex Mono 12, subtle |
| Group label | Mono 11 / 0.16em, uppercase, subtle (500 weight in dark) |
| Nav item | 15 / 400; active 600 |
| Account name | 15 / 600, role 400 subtle |

## Spacing

- Rail padding 28 / 16 / 20; 26px between blocks and between nav groups.
- Item 40px tall, 12px side padding, 12px icon-to-label gap, 2px between items.
- Icons 20px in nav, 18px in menu links.

## Rules

- One item style everywhere. No per-item colors, badges or type sizes.
- Counts are totals, in mono, right-aligned. Don't show 0.
- Only one active item. Active never uses a left border stripe; it's a tint fill.
- Settings that aren't navigation (photo, role, appearance, sign out) live in the account menu, not the rail.
- New pages go into an existing group. Add a fourth group only if an item fits none of the three.

## Accessibility

- Each group is a `<nav aria-label>`; active item has `aria-current="page"`.
- Account row is a button with `aria-expanded`; the menu closes on Escape and returns focus.
- Segmented controls use `aria-pressed`.
- Forced-colors: active item and selected segments get a `CanvasText` border.

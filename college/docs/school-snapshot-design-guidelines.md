# School snapshot v2: design guidelines

These rules are specific to the snapshot facts panel. The project-wide rules (tokens, type, states) are in The Track `design-guidelines.md`, and they apply here too.

## Tokens

- Ground `#f3f2f2` · ink `#201e1d` · muted `#444141` (labels) · subtle `#605d5d` (mono notes, Not offered)
- Accent `#e85504` (status headline, unset underline, focus) · accent text `#9e3603` ("Set", "Track another program", links)
- Divider `rgba(32,30,29,.16)` (row rules, left rule)
- Offered green `oklch(0.50 0.11 150)`, shared with selectivity tier 1. It's used only for Offered.

## Type

| Element | Spec |
| --- | --- |
| Area label | Mono 11 / 500, 0.16em, uppercase, subtle |
| Area headline | 36 / 1.1 / 700, −0.02em |
| Row label | 17 / 400, muted |
| Row value | 17 / 600, ink |
| Missing-from-record note | Mono 11, subtle, under the label |

## Spacing

- Area: 4px ink top rule, 16px padding above the label, 14px stack gap, 6px extra under the headline.
- Fact list: 1px left rule. Rows are 56px minimum height, with 8px vertical padding and **20px left inset**.
- Row grid: `200px | 1fr`, 20px gap, values left-aligned.
- Area grid: 2 columns, with 64px gaps between rows and 56px between columns. One column below 800px, where each row also stacks (label above value).

## Editable values

| State | Look |
| --- | --- |
| Unset | "Set" in accent text, orange dashed underline, ▼ caret |
| Set | Value in ink 600, 35% ink dashed underline, ▼ caret |
| Hover | Underline turns solid |
| Focus | 2px orange outline, 2px offset |

- These are native controls with the browser appearance removed. Don't use custom dropdowns.
- Changes save right away. There's no Save button, and no confirmation for reversible changes.
- Read-only values have no underline and no caret. That difference is the only signal of what can be edited, so don't add icons or tints.

## Offered mark

- 22px circle. Offered: green fill with a white ✓, then "Offered" in green 600. Not offered: `#9b9797` fill with "–", then "Not offered" in subtle 600.
- The mark is `aria-hidden`, and the word carries the meaning.
- The × to stop tracking sits after the status: a 28px target in subtle, which turns accent on hover with an 8% orange tint.

## Accessibility

- Every select and date input has an `aria-label` matching its row label.
- Text contrast is at least 4.5:1. The green at 17/600 clears 4.5:1 on the ground.
- Don't rely on color alone: Offered and Not offered are also different words and different marks.

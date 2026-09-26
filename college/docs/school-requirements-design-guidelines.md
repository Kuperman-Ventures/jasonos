# Requirements tab: design guidelines

These rules are specific to the Requirements tab. Project-wide rules (tokens, type, states) in the root `design-guidelines.md` still apply.

## Tokens

- Ground `#f3f2f2` · ink `#201e1d` · muted `#444141` · subtle `#605d5d`
- Accent `#e85504` · accent text `#9e3603` · accent-100 `#feeee4` · accent-200 `#fdd6c0` · accent-300 `#fab48e` · accent-900 `#461a05`
- Neutrals: 100 `#eceaea`, 200 `#dcdada`, 300 `#c9c6c6`, 400 `#9b9797`
- Fonts: Archivo (all UI), IBM Plex Mono (labels, counts, tags)

## Type

| Element | Spec |
| --- | --- |
| Section label | Mono 12 / 0.16em, uppercase, subtle |
| Stat value | 34 / 1 / 700, −0.02em, nowrap |
| Stat sub-label | 14, muted |
| Group header | 15 / 700, state color; count mono 13 subtle |
| Tile name / note | 15 / 700 · 13 |
| Checklist title / detail | 18 / 600 · 15 muted |
| Tag (Required, Not required) | Mono 12 / 0.08em, uppercase |

## Profile tile states

Don't rely on color alone. Each state also differs in fill type and in its group header word.

| State | Fill | Border | Text |
| --- | --- | --- | --- |
| Required | accent `#e85504` solid | accent | accent-900 |
| Modified | 135° stripes accent-200 / accent-100, 6px | accent | accent-900 / note accent-800 |
| Not required | neutral-200 solid | none | ink / note muted |
| Not listed | none | 1px dashed neutral-400 | muted / note subtle |

Tiles are a fixed 88px high so the bar has one clean bottom edge.

## Checklist status

| Status | Look |
| --- | --- |
| Not started | Outline neutral-300, muted text, neutral-400 dot |
| In progress | accent-100 fill, accent-300 border, accent-900 text, accent dot |
| Done | neutral-100 fill, ink text, ink dot |

Hover sets the border to accent. Not-required rows stay in subtle text with no strikethrough.

## Spacing

- Modal: 28/40/56 padding, 36px between sections.
- Stat row: 32px column gap. Profile: 20px between groups, 4px between tiles. Checklist rows: 18px vertical padding (14px for quiet rows), 1px neutral-200 top rule.

## Accessibility

- Status buttons announce their state as text. Add an `aria-label` like "Personal essay: In progress, click to change".
- Stat values that ellipsize get a `title` with the full value.
- School mark has `title` = school name.

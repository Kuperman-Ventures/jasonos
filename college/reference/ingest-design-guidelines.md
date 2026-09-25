# Ingest: design guidelines

These rules are specific to the Ingest flow. The project-wide rules (tokens, type, states) are in The Track `design-guidelines.md`, and they apply here too.

## Tokens used

- Ground `--color-bg #f3f2f2` · surface `#eae9e9` · divider `rgba(32,30,29,.16)`
- Text `#201e1d` · muted `#444141` · subtle `#605d5d` · accent text `#9e3603`
- Accent `#e85504`, pressed `#c74503`. The accent is used only for the primary button, the current step bar, and job cards that are on.
- Tag fill `#fdd6c0` with text `#742703`, used only for "Updates existing".
- Fonts: Archivo for everything a person reads; IBM Plex Mono for labels, counts, dates and source locators.

## Type

| Element | Spec |
| --- | --- |
| Page title | 42 / 1.1 / 700, −0.02em |
| Step label | 18, 700 when current, 500 otherwise |
| Group heading (To-dos, Calendar) | 24 / 600 |
| Job card title | 18 / 600 · description 15 / 1.5 muted |
| Row title | 16 / 600 · evidence 14 italic muted |
| Labels | Mono 11, 0.16em, uppercase, subtle |
| Data (counts, sources, meta) | Mono 12–13, tabular, subtle |

## Layout

- Content column max 1180px, padding 56/64. Step 1 fields cap at 720px, and job cards at 900px.
- Vertical rhythm: 40px between page head, stepper and step body; 20px inside a step; 40px between review groups.
- Review rows are a fixed column grid, so owners, dates and sources line up down the page. Rows are separated by hairlines. Groups have no boxes around them.
- Below 900px, job cards stack and review rows go to 2 columns, with the title spanning the full width first.

## Components

- **Stepper:** a 4px top bar only, with no circles or connectors. Orange = current, ink = done, `#d7d3d3` = upcoming. Steps that can't be reached yet are disabled.
- **Drop zone:** 1px dashed border on surface. On drag-over the border turns orange with a 6% orange tint.
- **Job card:** a toggle button. When off: 1px border at 30% ink. When on: 2px orange border, and the 20px box fills orange with a white ✓. Padding shrinks by 1px when on, so the card doesn't shift.
- **Keep/Skip:** a two-part segmented control. The active part is filled with ink. A skipped row fades to 45% opacity and stays in place, so it can be un-skipped.
- **Primary button:** solid orange with white 16/600 text, and exactly one per step. The label always says what will be saved.
- **Ghost button:** accent text, no border ("Back", "Back to jobs", "Remove").

## Copy

- Jobs: "Save as a note" · "Find to-dos" · "Find calendar events".
- Step 3 is labelled "Review", or "Save" when only the note job is on.
- The save button reads "Save note + 3 to-dos + 2 events". Parts with a count of 0 are left out.
- Counts use the form `{kept} of {n} kept`.

## Accessibility

- Job cards and Keep/Skip buttons expose `aria-pressed`. The current step has `aria-current="step"`.
- Errors use `role="alert"`, and the save status uses `aria-live="polite"`.
- Every input in a row has an `aria-label` (Owner, Due date, Date, Time).
- Focus: 2px orange outline, 2px offset. Minimum touch target is 44px for buttons.

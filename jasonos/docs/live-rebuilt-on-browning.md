# Live rebuilt on Browning

Source of truth for this rebuild: the Cursor build prompt **JasonOS Live: Call Sheets, People and Playbooks**, as amended by **Amendment 1 (interface, save rules, People)**.

The longer design memo was not available in the agent environment. Screen-level interface rules live in Amendment 1 §4. Brand rules: [`docs/design/JasonOS-Brand-Guideline-v2.md`](design/JasonOS-Brand-Guideline-v2.md).

## Three objects

1. **Person** — relationship record (Browning tracking columns on `contacts` + `relationship_log`).
2. **Call Sheet** — one readable page per call (blocks from the playbook; Read / Rehearse / Live / Debrief views of the same sheet).
3. **Playbook** — template for a kind of call (`live_scripts` with `family`, `blocks`, `time_budget`, `objections`).

## Vocabulary (interface only)

Playbook · Call Sheet · Sheet · Person · Build · Ready · Confirm. Do not show: strategy, plan, guide, script, apply, adapt, attach, promote.

## Amendment 1 overrides

- Live home is two columns: **Calls** and **This week**. No People in motion panel.
- People index at `/live/people` with overdue pills.
- Every typed field uses `SaveRow` + `useSavedField`. No silent autosave (except the Live point note on blur / Next).

## Browning ten-block shape

Who · Why · What and how · Set expectations · Rapport · The conversation · Turn to me · The ask · Close · After.

Other playbooks use a subset or free blocks. Blank: Who · What I want · Points · Close · After.

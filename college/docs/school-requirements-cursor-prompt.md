# Cursor prompt: School detail modal · Requirements tab

Rebuild the **Requirements** tab of the school detail modal. Today it is a stack of editable text boxes (Test policy, Middle 50%, Application platform, Teacher recommendations, SAT context, Required essays, Admissions context). Replace it with a read-first layout: a comparable dashboard of what the school asks for, then the student's checklist against it.

Reference: `requirements.html` (working vanilla HTML/JS, UCLA as sample). Match its layout, spacing and behavior; port to the app's framework and data layer. Visual rules: `design-guidelines.md`.

## Role in the process

Requirements sits between research (Snapshot) and execution (Project management, To-Do). It answers two questions in order: *what does this school require?* and *where is the student on each piece?* Keep the top half identical in structure across schools so switching schools reads as a comparison.

## Structure (top to bottom)

Modal chrome unchanged (Close, main tabs, Settings).

### 1. Header
- Kicker row: **school mark** (24px square, 3px radius; school icon, fallback = first letter on school color, white 12/800) + school name (16/700) + `REQUIREMENTS` mono label. Use the same school mark wherever the school name appears.
- **Stat row**, 4 fixed columns in this order for every school: `TO SUBMIT` (count of Required + Modified items) · `PLATFORM` · `TESTING` (Required / Modified / Not required / Not listed; accent text when Required) · `RECOMMENDATIONS` (count required).
  - Value 34px/700, `white-space: nowrap`, ellipsis on overflow, fixed 34px height so sub-labels align. Sub-label 14px muted.
  - Columns `0.8fr 1.5fr 1.1fr 1fr`, 32px gap.
- **Progress**: 220×6px bar + `n of m done` (mono 13). Counts only To-submit items.

### 2. Requirement profile
- Fixed catalog, same keys for every school: Application, Personal essay, Supplemental essays, Test scores, Teacher recs, Counselor rec, Interview. (Extend the catalog globally, never per school.)
- Each item has a state: `req` Required · `mod` Modified (conditional or altered, e.g. test-optional, portfolio for some majors) · `no` Not required · `unk` Not listed (no data).
- Render as **one bar grouped by state**, in the order Required → Modified → Not required → Not listed. Skip empty groups. Group width = item count (`grid-template-columns: 3fr 2fr 2fr`).
- Group header: state name (15/700, state color) + count (mono 13).
- Tiles: 88px fixed height, 4px gap, name (15/700) and note (13) printed inside. Styles in `design-guidelines.md`.
- If no item is Modified, show `No modified requirements` (14, subtle) under the bar.

### 3. Checklist ("kit")
- Columns: `Status 150px | To submit 1fr | {School} says 150px | action 170px`.
- One row per Required/Modified item: status button, title (18/600) + detail (15 muted), `REQUIRED` / `MODIFIED` mono tag, `Add to To-Do` action.
- **Status button** cycles Not started → In progress → Done on click. Persist per `{ userId, schoolId, requirementKey }`.
- **Add to To-Do** creates a To-Do tagged with the signed-in user and the school (same tags as Project management notes), `sourceRequirement: key`. Then becomes `In To-Do ✓`, disabled. If the To-Do is deleted elsewhere, revert to `Add to To-Do`.
- Not-required items follow as quiet rows: `—`, title in subtle, `NOT REQUIRED` tag, no action. **No strikethrough.** Strikethrough reads as done.
- Not-listed items don't appear in the checklist, only in the profile.

### 4. Context
Two columns (`1.4fr | 1fr`, 56px gap):
- `WHERE {USER}'S SAT LANDS`: range bar on a 1200–1600 scale, middle-50% band, student marker + label, low/high ticks. Line below: `Middle 50%: {middle50}.` Hide the marker if the student has no score.
- `ADMISSIONS CONTEXT`: the school's text at 20/500.

### 5. Footer
`Test policy: … · Platform: …` in subtle, and an `Edit requirements` link on the right that opens the existing edit form (the old text boxes can live there). The main view is read-only.

## Data

```
school.requirements = {
  testPolicy, middle50, satRange: [lo, hi], admissionsContext, platform,
  profile: [{ key, label, state: 'req'|'mod'|'no'|'unk', note }]
}
requirementProgress = { userId, schoolId, key, status: 0|1|2, todoId|null }
```
Map existing fields: Test policy → `tests` state; Required essays → `essay` (and `supplements` if listed); Teacher recommendations text → `teacherRecs` + `counselorRec`; SAT context → `satRange`. Missing fields → `unk`.

## Responsive (<800px)
Stats 2×2; profile groups stack; checklist drops the "says" column; context stacks.

## Open questions
- "SAT or ACT" sub-label under Testing is placeholder copy. Confirm or pull from data.
- Sample SAT 1450 for Kyle is illustrative. Wire to the student profile.
- UCLA sample data says "Test required" and "Common App". Verify the ingest source, since UCLA is publicly test-blind and uses the UC application.

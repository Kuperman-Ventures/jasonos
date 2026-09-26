# Cursor prompt: School detail modal · Project management sub-tabs

Rebuild the **Project management** tab of the school detail modal. The tab currently stacks Contacts, Visit, Touchpoints and Deadlines in one long scroll. Split it into sub-tabs and add a new **Notes** sub-tab that routes notes to To-Do, Notes and Calendar.

Reference: `project-management.html` (working vanilla HTML/JS, UCLA as sample). Match its layout, spacing and behavior; port to the app's framework and data layer. Visual rules: `design-guidelines.md`.

## Structure

Modal chrome is unchanged (Close, main tabs Snapshot / Requirements / Financials / Project management / Settings). Under the page title and lede, add a sub-tab row:

**Notes · Contacts · Visit · Touchpoints · Deadlines**

- Notes is the default sub-tab.
- Sub-tab style: 15px text, 28px gap, active = 600 weight + 2px accent (`#e85504`) underline. Inactive = muted `#444141`, hover to text color.
- Count after the label in 11px IBM Plex Mono, subtle color. Hide when 0. Counts: Notes = notes sent from this school; Contacts = contacts; Touchpoints = logged; Deadlines = **open** (not done). Visit shows no count.
- Remember the last sub-tab per session if convenient; otherwise always open on Notes.
- Optional variant (class `rail` on `.sub`): 200px left rail, each item shows label + a mono status line (`2 sent`, `None yet`, `Planned · Oct 12, 2026`, `2 open of 2`). Collapses above the panel under 760px. Ship the top-tabs version unless told otherwise.

Lede copy: "Notes, contacts, visits, touchpoints, and deadlines for {School}. Notes can be sent to the household To-Do list, Notes board, or Calendar, tagged to the writer and this school."

## Notes sub-tab (new)

### Composer
1. `NEW NOTE` label, textarea (4 rows, placeholder `Write a note about {School}`).
2. Control row (wraps):
   - **Send to** — three multi-select toggle buttons: `To-Do`, `Notes`, `Calendar`. Default: To-Do on. Pressed = accent-100 fill `#feeee4`, accent-700 border `#9e3603`, accent-900 text, 600 weight, ✓ in the small box. Use `aria-pressed`.
   - **Date field** appears only when To-Do or Calendar is on. Label changes:
     - To-Do only → `Due (optional)`
     - Calendar only → `Calendar date` (required)
     - Both → `Date (due + calendar)` (required)
   - **Send** button, right-aligned, accent fill. Disabled (45% opacity) until: text is non-empty AND ≥1 destination AND (Calendar off OR date set).
3. Preview line under controls: `Shows up in To-Do and Calendar tagged [avatar] [school mark]`. With no destination: `Pick at least one destination. It will be tagged [avatar] [school mark]`.

**No "From" picker.** The author is always the signed-in user.

### On Send
Create one note record and route it to each chosen destination. Every destination item carries **both tags**: `userId` (signed-in user) and `schoolId` (current school), plus `sourceNoteId` for back-linking.

```
note = { id, text, userId, schoolId, dests: ['todo'|'notes'|'calendar'], date, createdAt }
todo     → { title: text, due: date || null, userId, schoolId, sourceNoteId }
notes    → { body: text, userId, schoolId, sourceNoteId }
calendar → { title: text, date, allDay: true, userId, schoolId, sourceNoteId }
```
See `routeNote()` in the reference. In To-Do, Notes and Calendar, render the same avatar + school mark pair on these items so it's clear who wrote them and which school they came from.

Clear textarea and date after sending; keep destination toggles as they were.

### Log
- Header: `{User}'S {SCHOOL} NOTES` (mono, uppercase — source string `Kyle's UCLA Notes`) with the count on the right.
- Newest first. Each row: note text (17px), `Remove` link-button top-right; meta line = user avatar, school mark, `→ To-Do Oct 9 · Calendar Mar 6` (dates shown for To-Do/Calendar only, no year; `white-space: nowrap`); created date in mono at right.
- Empty: `No notes yet.`
- Decide with the team whether Remove here also removes the routed items (recommended: ask, or remove only the log entry and leave routed copies).

### Tags
- **User:** 24px circle. Profile photo if available; fallback = initial on `#d3dcea` / `#2f5aa0`, 11px 700.
- **School:** 24px square, 3px radius. School icon if available; fallback = letter on school color (UCLA `#2774ae`), white, 12px 800.
- Both get `title` = full name.

## Contacts, Visit, Touchpoints, Deadlines

Same fields and behavior as today, each on its own sub-tab:
- **Contacts:** list rows (name 600, role, email as mailto link, phone, Remove); add row of Name / Role / Email / Phone + `Add contact`. Name required. Empty: `No contacts yet.`
- **Visit:** Visit status select (Not set, Planned, Visited, Virtual tour, Not visiting) + Visit date side by side; Visit notes textarea below.
- **Touchpoints:** rows show text + owner avatar (circle tag, not text) + Remove. Add row: text input, owner select (household members, default signed-in user), `Add`. Empty: `No touchpoints yet.`
- **Deadlines:** columns Done / Milestone / Due / (Remove). Done rows go subtle + strikethrough. Add row: Milestone + date + `Add deadline`; list stays sorted by due date. Deadlines are read-only text in rows (edit by remove + re-add, or keep inline editing if the app already has it).

## Tokens used
Background `#f3f2f2`, text `#201e1d`, muted `#444141`, subtle `#605d5d`, row rules `#eae7e7`, field border `#d7d3d3`, field fill `rgba(0,0,0,.03)`, accent `#e85504` (hover `#f58749`, text-on-accent `#461a05`). Fonts: Archivo (UI), IBM Plex Mono (labels, counts, dates).

## Acceptance
- Five sub-tabs switch panels without reload; counts update live.
- Notes cannot send without text + destination (+ date for Calendar).
- Sent notes appear in each chosen destination tagged with the signed-in user and the school, and in the Notes log here.
- All user/owner tags are circular avatars; all school tags are square marks.
- Layout holds down to ~360px wide (form grids collapse to one or two columns).

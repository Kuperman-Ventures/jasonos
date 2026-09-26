# Cursor prompt: Left rail · Process groups

Rebuild the app's left rail. The current rail grew item by item: mixed type styles, an ungrouped nav list, and a long account block (photo upload, roles, role description, remove photo, sign out, appearance) at the bottom. Replace it with the layout in `left-rail.html` (working vanilla HTML/JS). Match its layout, spacing and behavior; port to the app's framework, router and auth.

Visual rules: `design-guidelines.md` (this rail) and `the-track-design-guidelines.md` (project-wide, including §2b Dark mode). Build light and dark together using the tokens.

## Structure (top to bottom)

Rail: 280px wide, sticky, full height, scrolls on its own if the window is short. Padding 28/16/20, 26px between blocks.

1. **Brand**: duotone graduation cap (30px, brand blue) + household name (17/700) + `{Grade} · {High school}` (13, subtle). City/state is removed from the rail.
2. **Phase card** ("you are here"): card fill, 3px radius, 14/12 padding.
   - Row: phase name (15/600) left, `n / 6` (mono 12) right.
   - 6-segment bar, 5px high, 3px gaps. Segments up to and including the current phase are accent; the rest are line color.
   - `Next: {next phase}` (13, subtle).
3. **Nav**, three fixed groups, in this order:
   - **Plan**: Dashboard, Project Management, Notes, Log
   - **Schools**: Colleges, Apps & Materials, Ingest
   - **Reference**: Consultants, FAQ, Testing
   - Group label: mono 11 / 0.16em uppercase, subtle, 6px above items.
   - Item: 40px row, 12px side padding, 3px radius, duotone icon 20px + label 15px, count right-aligned in mono 12. Hide the count when it's 0 or null.
   - Hover: hover fill. Active: tint fill, on-tint text, weight 600, icon in `--icon-on`. Set `aria-current="page"`.
4. **Account row** at the bottom: 32px avatar (photo or initial) + `Jason · {view-as role}` + dots icon. Opens the account menu.

**Admin** moves from the nav into the account menu.

## Account menu

A popover above the account row, 290px wide, 18px padding, 18px between sections.
- **Who**: 44px avatar, name, `Change photo` · `Remove` links (hide Remove when there's no photo).
- **View as**: segmented Admin / Parent / Student (only the roles the user holds). Selected = tint fill. The role description shows below it.
- **Appearance**: segmented System / Light / Dark. System follows the OS (`prefers-color-scheme`) and updates live. Save to the user profile; `localStorage` is the fallback. Apply `data-mode` on `<html>` before first paint.
- **Links**: Admin (gear), Sign out.
- Closes on outside click, Escape (return focus to the account row), or navigation.

## Icons

Phosphor, duotone weight: Dashboard `squares-four`, Project Management `kanban`, Notes `note-pencil`, Log `clock-counter-clockwise`, Colleges `bank`, Apps & Materials `files`, Ingest `tray-arrow-down`, Consultants `users-three`, FAQ `question`, Testing `exam`, Admin `gear-six`, Sign out `sign-out`, brand `graduation-cap`, account `dots-three`.

## Data

```
household = { name, student, grade, school }
user = { name, photoUrl, roles[], signedInAs }
phase = { index, total, name, next }
counts = { projectManagement, colleges, appsMaterials, consultants, faq, testing }
```

## Open questions
- Role descriptions for Parent and Student weren't in the screenshot. Pull them from the existing app.
- The rail doesn't collapse on narrow screens yet. Decide whether small windows get a slide-out drawer.

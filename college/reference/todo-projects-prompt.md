# Cursor prompt — Projects in the To-dos list (group by project, grip to move)

Add projects as a top-level concept to the To-dos view. To-dos can be grouped by person (today's view, unchanged) or by project, and each to-do moves between projects with a grip handle that can be dragged or clicked. Reference implementation: `todo-projects.html` in this folder. Match it exactly. Follow `design-guidelines.md` for tokens, type and states.

## Data

- New `Project`: `{ id, name, colorIndex, familyId, createdAt }`. Names are required, trimmed, max 60 chars.
- `Todo` gets `projectId: string | null`. A to-do is in zero or one project.
- Deleting a project sets `projectId = null` on its to-dos. **Never delete to-dos with a project.**
- Project colors come from a fixed set of five: `#7a3b69`, `#5b4a9e`, `#2f6aa3`, `#3f7d4f`, `#8a5a1f`. New projects take the next color in order. Don't reuse the orange accent or the selectivity tier hues.

## Group by switch

- A `Group by` row sits under the Timeline / To-dos / Calendar tabs: mono 11px uppercase label, then a two-button segmented control, `Person` and `Project`. Selected: 2px `--accent` border on the field color. Unselected: chip fill with 1px line. Use `aria-pressed`.
- `＋ New project` (dashed 1px border, accent-text, 600) sits after the switch and shows only in Project view.
- Remember the user's last choice per device (localStorage).

### Person view
Exactly today's layout: my section full width, then `Everyone else` with one column per person. Each row gets a second line under the title with the **project tag**. It shows the project's color square and name, or a dashed `＋ Project` when the to-do has none. Clicking the tag opens the Move menu. "From Jason" moves onto the same second line. No grip in this view.

### Project view
One full-width section per project in creation order, then `No project` last (grey `#d7d3d3` square). Header: 18px color square, name (30/700), `Edit` chip, and the `N OPEN · N DATED` stat on the right. Rows show the owner's initials avatar (28px) instead of a project tag, since the section already says the project. Empty project: "Drag a to-do here, or use its dots to choose this project."

## The grip (Project view)

Each row starts with a `⋮⋮` grip button (26×30, faint ink, `cursor: grab`). It does two things:

1. **Drag** it to another section to move the to-do there. Dropping on `No project` removes it from its project. While dragging, the source row drops to 40% opacity, every section gets a 1px dashed outline (8px offset), and the section under the pointer gets a 2px `--accent` outline with a `rgba(232,85,4,.06)` fill. Use the whole row as the drag image.
2. **Click** it (or press Enter/Space) to open the **Move menu**. While the menu is open, the grip has an accent tint.

On touch, a tap opens the menu. Long-press drag is optional and can follow later, since the menu covers everything drag does.

## Move menu (shared by the grip and the project tag)

- A popover anchored under the row's left edge: 260px, field background, 1px border, `0 12px 32px rgba(32,30,29,.16)` shadow. `role="menu"`.
- It lists `MOVE TO PROJECT` (mono label), every project with its color square, and `No project` (dashed square). A `✓` marks the current project. After a divider comes `＋ New project…`.
- Picking a project moves the to-do and closes the menu. `New project…` opens the New project editor, and on Create the to-do moves into the new project ("1 to-do will move into it").
- Keyboard: focus goes to the first item. Up/Down cycle, Enter picks, and Escape closes and returns focus to the grip. An outside click closes the menu.

## Create / edit / delete

- An inline editor panel (surface fill, 3px `--text` top rule), not a modal. It holds a name input, five color swatches (radio group), `Create`/`Save`, and `Cancel`. Edit mode also has `Delete project` on the right in `--danger`.
- New project opens above the list. Edit opens inside that project's section, under its header.
- Enter saves and Escape cancels. Empty names can't be saved.
- Delete asks for confirmation in the same panel: "Delete “AP exams”? Its 3 to-dos stay on the list with no project." Buttons: `Delete project` (danger fill) and `Keep it`.

## Accessibility

- Grip: `aria-haspopup="menu"`, `aria-expanded`, and `aria-label="Move “{title}”. Drag, or press to choose a project"`.
- Dragging must never be the only way to move anything. The menu covers every move.
- Focus: 2px `--accent` `:focus-visible` outline, 2px offset. Hover tints: `rgba(232,85,4,.08)`.

## Don't

- Don't change the Person view's layout, type or spacing beyond adding the tag line.
- Don't add a separate Move button next to the grip. The grip is the control.
- Don't let a to-do sit in more than one project.
- Don't put projects in the left rail (yet).

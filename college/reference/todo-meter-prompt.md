# Cursor prompt: per-person meter at the top of To-dos

Add a meter to the top of the To-dos view that shows each person's total to-dos and how many are overdue. It shows in both the Person and the Project group-by views. The reference implementation is `todo-meter.html` in this folder (the `.meter` / `.mp*` / `.track` styles, plus `meterHTML()` and `overdue()`). Match it exactly. Nothing else on the page changes.

## Placement

- Put it directly under the `Group by` row and above any inline project editor and the list.
- It's the same element in both views. Don't re-render it differently per mode.
- Recompute it on every render so it updates when to-dos are added, completed, reassigned or moved between projects. Moving a to-do between projects doesn't change the counts.

## Data

- `total` is the number of open to-dos assigned to the person.
- `overdue` is the number of open to-dos whose due date is before today, in the family's local timezone. A to-do due today is not overdue. Undated to-dos are never overdue.
- Completed to-dos don't count toward either number.
- Show one entry for every family member, in the same order as the Person view (me first). Show members with 0 to-dos too.

## Layout

- The meter is a 3-column grid (`minmax(0,1fr)`), with 40px column gap to match the list grid. Below 900px it becomes 1 column. With more than 3 members it wraps onto more rows.
- Each entry is a column with a 10px gap:
  - **Head row:** a 28px initials avatar (the existing `.av.sm`), then the name (16/600), then the numbers pushed to the right.
  - **Numbers:** the figure is 20/700 in the body font, followed by a mono 12px, .12em-tracked uppercase label in `--subtle`. The pair reads `5 TOTAL` and `2 OVERDUE`, with a 14px gap between them. The overdue figure is `--danger`, or `--subtle` when it's 0.
  - **Bar:** an 8px-tall track filled `rgba(32,30,29,.08)`. The total fill is `#b9b5b4`, and its width is `total / max(total across people)`, so bars compare people against each other. Inside it, the overdue segment is `--danger` and sits at the left, with width `overdue / total` of the fill. It has no radius, because the app uses square edges.
- No borders, cards or dividers around the meter. Whitespace separates it from the list (the page's existing 26px stack gap).

## Rows

- Overdue rows show their due date in `--danger`, weight 700 (`.date.over`). This takes precedence over the existing `soon` style.

## Accessibility

- Each bar is `role="img"` with `aria-label="{Name}: {n} to-dos, {o} overdue"`.
- The meter container has `aria-label="To-dos per person"`.
- The meter isn't interactive in this version. Don't make entries clickable or give them hover states.

## Don't

- Don't add percentages, trend arrows or other stats.
- Don't use the orange accent in the meter. Only the neutral fill and `--danger` are used.
- Don't hide the meter in either view or collapse it behind a toggle.
- The reference page fakes "today" as Sep 25 and has three past-due sample dates (`TODAY` const). Use the real current date and real data.

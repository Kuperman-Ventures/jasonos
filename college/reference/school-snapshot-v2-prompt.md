# Cursor prompt: School snapshot v2 (7b, label column, set in place)

Update the School snapshot facts panel (Admissions, Where you stand, Programs, Campus). The reference implementation is `school-snapshot.html` in this folder. Match its layout, copy and states exactly. The rules are in `design-guidelines.md`. **Location and Selectivity (the map and the gauge) are unchanged.** Keep them as they are.

## 1. Spacing and layout

- Keep the 4px ink top rule on each area, the hairline under each row, and the 1px left rule on each fact list.
- Rows get a **20px inset from the left rule** (`padding: 8px 0 8px 20px`) and a **56px minimum height**.
- Rows are a grid, `200px | 1fr` with a 20px gap. Values are **left-aligned** in the second column, right after the label, not pushed to the right edge.
- Area headline is 36/700, −0.02em, with 6px of space under it. Areas sit in a 2-column grid with gaps of 64px (rows) and 56px (columns).
- Below 800px, the areas go to one column, and each fact row stacks with the label above the value.

## 2. Values you can set vs. values from the record

Split every field into one of two groups:

**Family-owned (editable in place):**

| Field | Control | Options |
| --- | --- | --- |
| Interest | select | Top choice · High · Medium · Low |
| Application status | select | Not started · Researching · In progress · Submitted · Decision in |
| Admission track | select | Early Decision · Early Action · Restrictive Early Action · Regular Decision · Rolling |
| Next deadline | date | — |
| Programs you track | add / remove | Any program in the school's record |
| Any record fact that is `null` (e.g. Test policy) | select | Field's allowed values |

**From the record (read-only):** SAT, Pathway, Degree shape, City, Site, each program's offered status, and the area headlines for Admissions and Campus.

Behaviour:

- An editable value looks like text with a dashed underline and a ▼ caret. The underline turns solid on hover. It's a native `<select>` or `<input type="date">` with the browser appearance removed.
- When the value is unset, it reads **Set** in `--text-accent`, with an orange dashed underline. The first option of a set value is **Clear**.
- If a record fact is missing, the row becomes editable and shows a mono sub-label, "Missing from record", under its label. Store the family's value separately from the record, and never overwrite the record. Once the record gains a value, show the record value read-only.
- Every change saves right away, with no Save button. Use an optimistic update, and roll back on error with a toast.
- The "Where you stand" headline shows the Application status value, or "Not started" if it's unset. It's in `--color-accent`.
- **Remove the "Set these" link.** Every editable row now works on its own.

## 3. Programs: offered as a check

- For each tracked program, show a 22px filled green circle with a white ✓ and "Offered" in green `oklch(0.50 0.11 150)` at 600 weight.
- If the school doesn't offer it, show a grey `#9b9797` circle with "–" and "Not offered" in `--text-subtle`.
- Each program row has an × button (28px, `aria-label="Stop tracking {program}"`) that removes it from the family's tracked list.
- The last row is a ghost select, "＋ Track another program", in `--text-accent`. It lists the programs not yet tracked.
- The headline is computed: "Offered" (1 of 1), "Both offered" (2 of 2), "All N offered", "N of M offered", or "None tracked".
- Degree shape stays read-only, below the program rows.

## Don't

- Don't add boxes, tints or cards around rows. Spacing and the existing rules do the separating.
- Don't use cyan for Offered anymore. Green is for offered only.
- Don't make record values editable when they have a value.
- The sample data (Berkeley) and the `MINE`/`RECORD` objects are for the reference only. Wire them to the real school record and the family's per-school settings.

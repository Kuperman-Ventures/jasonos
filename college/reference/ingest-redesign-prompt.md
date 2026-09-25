# Cursor prompt: redesign Ingest as a three-step, whole-asset flow

Replace the current Ingest page (`college/components/IngestPanel.tsx`, `.ingest-*` styles in `college/app/globals.css`) with a three-step flow. The reference implementation is `ingest.html` in this folder. Match its layout, copy and states exactly. `design-guidelines.md` has the visual rules.

## The model

The user brings in **one whole asset**: a PowerPoint deck, an email, or pasted text. They choose any combination of three **jobs**:

1. **Save as a note.** The whole asset becomes one Notes pinboard item, with no review.
2. **Find to-dos.** Parse for tasks, then the user reviews each one.
3. **Find calendar events.** Parse for dates, then the user reviews each one.

Any 1, 2 or 3 jobs can be picked. Only extracted to-dos and events are reviewed. The note is saved as-is.

## Step 1 · Asset

- One drop zone (click to choose, or drag and drop). It accepts `.pptx .key .pdf .eml .msg`, max 25 MB.
- Below it, a mono label `OR PASTE TEXT` and a textarea.
- A file and pasted text are alternatives. If both are present, the file wins, and "Remove" on the asset row falls back to the paste.
- Once a file is picked, show an asset row: kind tag (`DECK` / `EMAIL`), filename, and mono meta (slide count or sender, then size).
- **Next** stays disabled until a source exists.
- Errors (accent text, `role="alert"`): "Use a PowerPoint, Keynote, PDF or email file." · "File is too large (max 25 MB)."
- Keep the existing forward-to-address idea only if the backend supports it. Otherwise drop that line.

## Step 2 · Jobs

- Heading: "What should we do with {asset name}?"
- Three toggle cards (`aria-pressed`), all on by default. A card that's on has a 2px orange border and a filled check box.
- The primary button reads **Find items**, or **Next: save** when only "Save as a note" is on. It's disabled when no job is on.
- Clicking the primary runs extraction only for the jobs that are on (text extraction → `/api/ingest`). While it runs, show the status line ("Reading deck…", "Finding to-dos…").

## Step 3 · Review (label becomes "Save" when only the note job is on)

- **Note row** (if the note job is on): surface strip with a `NOTE` label, an editable title (defaults to the filename without extension), and the meta `whole deck · to Notes pinboard`.
- **To-dos group** (if on): an H2 "To-dos" with `{kept} of {n} kept`, then one row per item. The row grid is `150px | 1fr | 130px | 110px | 90px`:
  1. Keep/Skip segmented control. Keep is the default, and a skipped row drops to 45% opacity.
  2. Title (16/600), an optional `UPDATES EXISTING` tag, and the quoted evidence in italics.
  3. Owner select (Kyle / Jason / Kat).
  4. Due date.
  5. Source locator in mono ("Slide 6", "Para 2").
- **Calendar group** (if on): the same grid, with the columns being Keep/Skip, title + location, date, time, source.
- The primary button's label is live: "Save note + 3 to-dos + 3 events". Only non-empty parts are listed. **Back to jobs** is a ghost button.
- On save:
  - The note job pins the whole asset (file attached, or pasted text as the body) to Notes.
  - Every kept to-do is created with `assignedBy` = the current user and linked to the ingest source.
  - Every kept event is created with its date and time.
  - Append a Recent ingest history row and an activity log entry (`Ingested "{title}"`).
  - Keep the existing approve/reject feedback POST. Kept = approved, for both to-dos **and** events.

## Stepper

- A 3-column grid. Each step is a 4px top bar, a mono number, a label and a mono sub-line.
- The bar is orange for the current step, ink for completed steps and `#d7d3d3` for upcoming ones. Only reachable steps are clickable.
- The step 2 sub-line lists the picked jobs. The step 3 label and sub-line change for note-only.

## Remove

- The separate paste / file / URL sections, "Save paste as note", "Save as-is" checkboxes, and the To-do / Note / Calendar / Drop route rocker and Trash. Keep/Skip replaces all of these.
- The URL path is out of scope for this version.

## Keep

- Page head (dateline + "Ingest").
- The Recent ingest list below the flow, unchanged. It isn't in the reference file.
- Auth, `assignedBy`, Supabase `college-ingest` storage and the OCR/PDF extraction pipeline.

## Don't

- Don't add a second accent, cards around groups, or icons.
- Don't show review rows for jobs that are off.
- Don't save anything before the final button is clicked.
- The sample data and the "start at step 3" demo line at the bottom of the script are for the reference only. The real page starts at step 1 with empty state.

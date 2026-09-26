# Cursor prompt: School detail modal · Photos tab + Visit planning tab

Two new tabs in the school detail modal. Build both from the working references in this folder, porting to the app's framework, router and data layer.

- `photos.html`: the Photos tab and its full-screen viewer
- `visit-planning.html`: the Visit planning tab (trip clusters + draft itinerary)
- `design-guidelines.md`: rules specific to these two tabs
- `the-track-design-guidelines.md`: the site-wide system, including §2b Dark mode. Build light and dark together using its tokens.

Both references include a Light/Dark demo switch. Remove it; the app's Appearance setting drives the mode.

Tab order in the modal: Snapshot · Requirements · Financials · Project Management · **Photos** · **Visit planning** · (spacer) · Settings.

---

## 1. Photos tab

### Layout
1. Header kicker: 24px square school mark + school name + `PHOTOS` mono label (same as the other tabs).
2. **Our visit** (first): family photos. Heading `Our visit · {visit date}`, count on the right.
   - Grid of square thumbnails (`auto-fill, minmax(180px, 1fr)`, 10px gap), each with a caption (13px, muted) under it.
   - On each thumbnail: the uploader's 24px circle avatar bottom-left (with a 2px ground-colored ring), and an orange duotone star top-right if starred.
   - Last tile is a dashed **Add photos** tile that opens a file picker (`image/*`, multiple).
   - Uploaded photos are tagged with the signed-in user and the school automatically, the same way Notes are. No pickers.
   - If there are no family photos, the section shows only the Add photos tile.
3. **From {School}**: photos from the ingest pipeline. Smaller square grid (`minmax(96px, 1fr)`, 4px gap), no captions in the grid. Keep `source` for attribution.

### Viewer
- Clicking any thumbnail in either section opens a full-screen viewer at that photo.
- The viewer walks **one roll**: all family photos first, then all school photos. Kyle can move through everything without going back to the grid.
- Ways to move: prev/next buttons, ← → keys, the mouse wheel or trackpad (throttled to one step per ~280ms), a horizontal swipe on touch (40px threshold), or clicking the filmstrip.
- Wraps around at both ends.
- Top: section name (`OUR VISIT` / `FROM UCLA`) left; `n / total` and Close right.
- Caption row: uploader avatar (family photos only), caption, then meta: `{name} · {date}` for family photos, `Source: {domain}` for school photos.
- Filmstrip: 44px thumbs, active one ringed in accent, scrolls horizontally and keeps the active thumb centered.
- The viewer is always dark (`rgba(22,24,27,.97)`) in both modes. Images are `contain`, never cropped.
- Esc or Close exits and returns focus to the thumbnail that opened it. Lock body scroll while open. `role="dialog" aria-modal="true"`.
- Under 700px: hide the side arrows (swipe instead), drop the side padding.

### Data
```
photo = { id, schoolId, src, caption, kind: 'family'|'school',
          userId?, visitDate?, starred?,      // family
          source?, category? }                 // school
```

---

## 2. Visit planning tab

The tab suggests which schools to visit together, then turns the choice into a trip.

### Trip clusters
- Nearby schools grouped into three rings around the current school, in this order: **Same day**, **+1 day**, **Longer trip**. Each shows a name, a subtitle (area), its day count in mono accent text, and an **Add to trip** toggle (becomes `In trip ✓`).
- A **chain** of school chips in suggested visiting order, with drive time between stops (`— 20 min —`, mono 12).
- Chip: 36px, school mark + name. **Fill = Kyle's interest level**, using the exact ramp from the Interest picker handoff (6a · One blue):
  - Top choice `--lvl-4` · High interest `--lvl-3` · Moderate interest `--lvl-2` · Safety / backup `--lvl-1`, with each level's `-fg` label color.
  - Not on list: transparent with a 1px dashed border. Include these when they're on the route (e.g. Caltech).
  - The school being viewed gets a 2px ink ring, offset 2px (`box-shadow: 0 0 0 2px bg, 0 0 0 4px ink`).
- A one-line note under each chain (timing conflicts, shared campuses, same application).
- A legend under the clusters: `KYLE'S INTEREST` + the five levels, then `This school` on the right.
- Clustering: group list schools (plus notable non-list schools on the route) by drive time from the current school. Suggested thresholds: same day ≤ 45 min between stops, +1 day ≤ 90 min from the base, longer trip beyond that. Order stops to minimize total drive.

### Draft itinerary
- Title `{Trip name}` (22/700) + `{phase window} · {n} schools · {n} days`. The window comes from the student's current phase.
- Days in columns (`auto-fit, minmax(280px, 1fr)`), labeled `DAY 1 · MON APR 5`. Days come from the included clusters, in cluster order.
- Each slot: mono time, then a box.
  - School stop: school mark + title + optional sub, neutral surface fill. The current school uses the orange tint.
  - Drive / meal: dashed box with a duotone icon (`car`, `fork-knife`).
- **Send to Calendar** (primary): creates one Calendar event per school stop, tagged with the signed-in user and the school, `source: 'visit-plan'`. Also creates a To-Do per school: "Book {school} tour". Then show a toast: `{n} visits sent to Calendar`. Disabled when no cluster is included.
- If nothing is included: `Add a cluster above to start a trip.`
- Footer note: `Tour and info session times are placeholders until booked.`

### Data
```
cluster = { id, name, sub, days, stops: [{ schoolId, driveFromPrev }], note, plan: [[slot]] }
slot = { time, schoolId|null, title, sub?, icon? }
interest[schoolId] = 'safety'|'moderate'|'high'|'top'   // missing = not on list
trip = { name, window, start }
```

---

## Open questions
- **Drive times and tour times** in the references are samples. Decide the source (maps API for drive times; school tour calendars or manual entry for sessions).
- **Interest palette:** the Interest picker handoff left its palette as a choice. These references use 6a · One blue (its default). If 6b or 6c ships instead, swap the `--lvl-*` values; nothing else changes.
- **Deleting a trip after sending:** should it remove the Calendar events and To-Dos it created? Same open question as Notes.
- **Categories for school photos** (Campus, Dorms, Dining…) are in the data model but not shown in this version.

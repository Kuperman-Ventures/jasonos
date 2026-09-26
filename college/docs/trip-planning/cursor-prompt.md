# Cursor prompt: School detail modal · Trip planning tab

Build the **Trip planning** tab of the school detail modal. It replaces the "Visit planning" tab in `handoff-photos-visits/` (ignore `visit-planning.html` there; `photos.html` still applies).

Attach:
- `trip-planning.html`: a working reference with all five sub-tabs, light and dark. Match its layout, behavior and tokens; port to the app's framework.
- `tokens.css`: color tokens for light and dark. The reference links it directly.
- `design-guidelines.md`: rules for this tab.
- `the-track-design-guidelines.md`: site-wide system, including §2b Dark mode.

Remove the Light/Dark demo switch; the app's Appearance setting drives the mode.

Tab order: Snapshot · Requirements · Financials · Project Management · Photos · **Trip planning** · (spacer) · Settings.

## Sub-tabs

Underline sub-tabs, same style as Project Management: 15px, active 600 with a 2px accent underline, optional mono count.

| Sub-tab | Count | Contents |
| --- | --- | --- |
| Nearby | `{n} in trip` | Trip map + cluster list |
| When to go | — | Week grid: Kyle's breaks vs. each campus calendar |
| Itinerary | `{n} days` | Day-by-day plan + Send to Calendar |
| Climate | — | 12-month climate strip + compare |
| All schools | `{n}` | US map of the whole list with region outlines |

All sub-tabs share one trip state: `{ clusters in trip, week }`. Changing either updates Nearby, When to go and Itinerary. Persist it per `{ userId, schoolId }`.

## 1. Nearby

- **Map** (Leaflet + OpenStreetMap tiles, attribution required). Tiles are desaturated with a CSS filter on `.leaflet-tile-pane`: `grayscale(1) contrast(.82) brightness(1.1)` light, `grayscale(1) invert(1) contrast(.8) brightness(.85)` dark. Scroll-wheel zoom and double-click zoom are off.
- **Pins**: 26px chips with the school mark, filled with Kyle's interest color (`--lvl-1…4` + `-fg`). Not on list = ground fill + 1.5px dashed border. The school being viewed gets a 2px ink ring, offset 2px. Pins with inactive clusters dim to 35%.
- Campuses within ~1 km (Pomona / Harvey Mudd) are nudged ±17px so they never overlap.
- **Airport pin** (mono, ink) only shows at zoom ≥ 10.5.
- **Routes**: straight polylines in visiting order. Inactive: 2px ink at 35%, dashed `4 6`. Active: 4px `#e85504`, solid, on top. Leg labels (mono 11, ink chip) show only for the active cluster, at a per-leg position along the line (`at`, default 0.5) so they don't cover pins. A leg of `null` has no label.
- **Opens** fitted to the active cluster (`padding 70, maxZoom 12`). Hovering or clicking a cluster card flies to it. Double-clicking the map fits every school.
- **Cluster list** (320px): name, day count (mono accent), area + note, school marks in interest colors, `Add to trip` toggle. Then a "Getting there" block (flight from home airport).
- **Pin popup**: name, interest level, cluster, and the same Add to trip toggle.
- Legend under the map: `KYLE'S INTEREST` + five levels, then `This school`.

## 2. When to go

- Columns: nine weeks (Mondays) around the student's break. Header cell = week date + `week` / `best fit`. Selected week is filled ink.
- Rows: Kyle (`Break` = solid accent, `School` = surface), then **one row per school in the trip**, then the destination's weekly weather.
- Campus cells: `Classes` surface, `Break` dashed outline, `Finals` orange stripes.
- **Best fit** = Kyle is on break and every trip school is in session.
- Clicking any header or cell sets the trip week.
- Verdict below, two columns: schools on break or in finals that week (with why that matters), or "Every campus is in session". Kyle's status, plus a link to the best-fit week if the selected week isn't it.
- Top right: weather chip for the trip dates.
- If nothing is in the trip: "Add a cluster in Nearby to see its calendars."

## 3. Itinerary

- Title + `Week of {week} · {n} schools · {n} days`. Days come from the included clusters in order, dated from the selected week's Monday.
- If any trip school is on break or in finals that week: an orange tint banner naming them, with `See When to go →`.
- Slots: mono time + box. School stops = mark + title + sub on surface (current school in orange tint). Drive and meal = dashed box with a mono kind label (`DRIVE`, `MEAL`).
- **Send to Calendar**: one event per school stop, tagged with the signed-in user and the school, `source: 'trip-plan'`, plus a To-Do "Book {school} tour" per school. Toast `{n} visits sent to Calendar`. Disabled when the trip is empty.

## 4. Climate

- Months run **Aug → Jul** so the school year (Sep–May) is one block, marked by a tint bar under the months.
- Per month: high–low range bar (accent) on a 15–95°F scale with gridlines at 30/50/70/90, high and low labels, rain bar (`--lvl-3`), snow in inches.
- **Compare with**: None · Home · one other school/city. The comparison draws as an ink outline bar and an outline rain bar. The snow row shows the comparison's snowfall.
- A one-sentence summary per place at the top. Generate from the data (warmest/coldest highs, rainy months, total snow).
- Data: monthly climate normals per campus (NOAA or similar), cached.

## 5. All schools

- d3 + world-atlas `countries-110m` (the pinned URL in the reference). Albers USA-style projection fitted to the lower 48, US on `--color-raised`, Canada/Mexico on `--color-surface-2`.
- **Region outlines**: for each region, a padded (15px), smoothed convex hull around its schools' projected points (`d3.polygonHull` + `curveCatmullRomClosed`). Faint fill, 1px dashed `--text-subtle` stroke. Label in mono 10 uppercase at the side set per region (`top/bottom/left/right`) so labels don't collide.
- Regions: **Northeast, Mid-Atlantic, South, Midwest, Mountain, Texas, West Coast.** Assign each school a region in data (by state), not by position.
- Dots: 6.5px, interest color, current school 8px with an ink ring. Home = ink diamond with a "Home" label.
- Right panel: one row per region with count, a composition bar (one segment per school, sorted by interest) and a travel note (Drive from home / Fly …).
- Hovering a region row or its outline highlights that outline (solid ink stroke, faint orange fill), fades the others to 35%, and dims dots outside it.

## Data

```
school = { id, name, mark, color, lat, lon, region, interest, calendar: { weekStart: 'break'|'finals' } }
cluster = { id, name, sub, note?, days, from?, fromLeg?, stops[], legs[], at?[], plan: [[slot]] }
slot = [time, schoolId|null, title, sub?, kind?]
trip = { schoolId, userId, clusters[], weekStart }
student = { breaks: [weekStart], homeAirport }
climate[placeId] = { hi[12], lo[12], precip[12], snow[12] }
```

## Open questions
- **Sources**: drive times (maps API), academic calendars (school sites or manual entry), Kyle's district calendar, climate normals.
- **Regions**: confirm the state → region mapping (PA as Mid-Atlantic, NJ/NY as Northeast in the sample).
- **Interest palette**: uses 6a · One blue. Swap `--lvl-*` if a different option ships.
- **Deleting a sent trip**: remove its Calendar events and To-Dos too? Same question as Notes.

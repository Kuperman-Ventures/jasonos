# Cursor Prompt - Visit Planning: Interest Filter And Map Routes

This adds two features to the Visit planning tab:

1. Filtering the nearby-school clusters by Kyle's interest level (sections 1-3).
2. Selecting schools and opening them as a multi-stop driving route in Google Maps or Apple Maps (section 4).

The Visit planning tab is specified in the `photos-and-visit-planning` handoff folder: `README-CURSOR.md` (Step 2), `design/design-cursor-prompt.md` section 2, and `reference/visit-planning.html`. Everything in those files still applies. This prompt covers only the changes. Build it after the Visit planning tab exists, or in the same pass if you are building that tab now.

## What It Does

**Interest filter.** Kyle can choose which interest levels to show. The clusters (Same day, +1 day, Longer trip) then show only nearby schools at those levels, with the visiting order and drive times recalculated for the schools that remain. The draft itinerary builds from the filtered stops.

**Map routes.** Kyle can select schools in the cluster chains and open them, in visiting order, as a driving route in Google Maps or Apple Maps. Each day of the draft itinerary also gets its own route links.

## 1. Turn The Legend Into The Filter

1. Move the interest legend (`.legend` in the reference) from below the clusters to above them, directly under the header kicker.
2. Make each of the five level entries a toggle button: Top choice, High interest, Moderate interest, Safety / backup, Not on list. Keep each entry's color swatch and text label.
3. Toggle style: 30px tall, 3px radius, same as the Add to trip button (`.include`). Off = outlined with `--dash` and muted text. On = the orange tint pressed style used by Add to trip (`aria-pressed="true"`).
4. Keep the `KYLE'S INTEREST` mono label at the start of the row and the `This school` key at the end. `This school` is a key only, not a toggle.
5. On the right side of the row, show a count in mono 12, subtle: `Showing {n} of {total} nearby schools`. `total` counts every school across all three clusters, not counting the current school.
6. When any level is off, show a `Show all` text link (accent text) after the count. It turns every level back on.
7. Default: all five levels on, so the tab looks the same as today until Kyle changes the filter.
8. Remember the selection for the signed-in user across schools and sessions. Use the app's user preferences if it has them; otherwise use `localStorage`.

## 2. Filter The Clusters

1. A school appears in a cluster chain only if its interest level is switched on. Schools with no interest level count as `Not on list`.
2. The current school always appears in its cluster with its ink ring, whatever the filter.
3. After filtering, reorder each cluster's remaining stops to minimize total drive time, and recalculate each drive leg between the remaining stops. Use the same drive-time source as the clusters. Do not show a drive leg from the original route that skips a hidden school.
4. Keep the three clusters and their order. Do not move a school into a different cluster because of the filter.
5. When a cluster has no schools left at the selected levels (apart from the current school), show one muted line in place of the chain, `No schools at these interest levels in this range.`, and hide that cluster's Add to trip button.
6. Hide the cluster note when its chain is hidden, since the note may mention schools that are filtered out.

## 3. Update The Draft Itinerary

1. The itinerary uses only the stops that pass the filter, in the recalculated order, with the recalculated drive times.
2. Update the title line counts (`{n} schools · {n} days`) to match.
3. Send to Calendar sends only the stops currently shown.
4. When every level is switched off, show `Select at least one interest level.` in place of the clusters and the itinerary, and disable Send to Calendar.

## 4. Send A Route To Google Maps Or Apple Maps

Both apps accept a link that opens directions with multiple stops. No API key or account is needed, and the app does not call either service. It only builds the links.

### 4.1 Where each school's location comes from

Add an optional `visitAddress` field to each school record (for example, the admissions or visitor center address). Build each stop's location from the first of these that exists:

1. `visitAddress`
2. Latitude and longitude, if the school record already has them, as `lat,lng`
3. `{full school name}, {city}, {state}` from the existing record

### 4.2 Selecting schools in the clusters

1. Clicking a school chip (`.stop`) in any cluster chain selects or unselects it. Each chip is a button with `aria-pressed`.
2. A selected chip shows a Phosphor duotone `check-circle` icon (16px) after the school name. Keep the chip's interest fill and, for the current school, its ink ring. Do not change the fill to show selection.
3. Kyle can select schools from more than one cluster.
4. The current school is not selected by default.
5. When the interest filter hides a selected school, remove it from the selection.
6. The selection lasts while the tab is open. It does not need to be saved.

### 4.3 The route bar

1. When at least one school is selected, show a route bar directly under the clusters: `{n} schools selected`, then the stops in order as plain text separated by `→`, then the buttons.
2. Stop order: cluster order (Same day, +1 day, Longer trip), then the order within each chain.
3. A `Start from` text input, empty by default, with the placeholder `Current location`. When empty, the route starts from the device's current location. When filled, that address is the starting point.
4. Buttons, in this order: `Open in Google Maps`, `Open in Apple Maps`, `Clear`. Both map buttons use `.btn-secondary` (outlined) with a Phosphor duotone `map-trifold` icon, because Send to Calendar stays the tab's one primary button. `Clear` is `.btn-ghost`. Each map button opens its link in a new tab.
5. Hide the route bar when nothing is selected.

### 4.4 Route links on the itinerary

1. Each day column of the draft itinerary gets two small text links under the day label: `Google Maps` and `Apple Maps`.
2. Each link covers that day's school stops in itinerary order. Skip drive and meal slots.
3. Day 1 starts from the `Start from` address if one is entered. Other days start from the device's current location.

### 4.5 Link formats

Google Maps (driving directions with waypoints):

```
https://www.google.com/maps/dir/?api=1&travelmode=driving&origin={start}&destination={last stop}&waypoints={stop 1}|{stop 2}|...
```

- Leave out `origin` when there is no start address; Google then uses the current location.
- When there is no start address, the first school is the first waypoint. When there is only one school, it is the destination and there are no waypoints.
- URL-encode every value. Encode the `|` separators as `%7C`.
- Google allows 9 waypoints on desktop but only 3 in a mobile browser, and a URL of at most 2,048 characters.

Apple Maps (unified Maps URL, multi-stop directions):

```
https://maps.apple.com/directions?mode=driving&source={start}&destination={last stop}&waypoint={stop 1}&waypoint={stop 2}...
```

- Repeat the `waypoint` parameter once per stop between the start and the last stop.
- Leave out `source` when there is no start address; Apple Maps then uses the current location.
- URL-encode every value.
- Multi-stop Apple Maps links need iOS 18.4 or later, or macOS 15.4 or later.

### 4.6 Long routes

To stay inside the mobile limit, each link holds at most 5 places: a start, up to 3 waypoints, and a destination. When a route has more stops than that, split it into numbered links (`Part 1`, `Part 2`). Each part starts at the last stop of the part before it. Show the parts as a short list of links in place of the single button.

## 5. Accessibility

1. Wrap the toggles in a group with `aria-label="Filter by Kyle's interest"`. Each toggle uses `aria-pressed`.
2. The text labels stay visible, so color is never the only signal.
3. Announce count changes with `aria-live="polite"` on the count.
4. In forced-colors mode, toggles get a `CanvasText` border, like the other chips.
5. Every toggle is at least 44px tall on touch screens.
6. School chips are buttons with `aria-pressed` for selection, and the check icon has an accessible name of `Selected`.
7. Map buttons and links say which app they open, so they are clear when read out by a screen reader.

## 6. Confirm Before Reporting Back

1. With all levels on, the tab looks and behaves exactly as before.
2. Turning off one level removes those schools from every chain, recalculates the drive legs, and updates the count and the itinerary.
3. The current school stays visible with its ring when its own level is switched off.
4. An empty cluster shows the muted line and hides its Add to trip button.
5. Turning everything off shows `Select at least one interest level.` and disables Send to Calendar.
6. The selection is still set after switching to another school and after reloading the page.
7. Selecting 3 schools from two clusters shows the route bar with the stops in the right order.
8. `Open in Google Maps` opens driving directions with the same stops in the same order. Test in a desktop browser and on a phone.
9. `Open in Apple Maps` opens the same route on an iPhone or Mac. Also test the Apple Maps link in a Windows browser and tell me what it shows, since Kyle works on a Windows PC.
10. With `Start from` empty, both apps start from the current location. With an address entered, both start from it.
11. A route of 7 schools splits into two parts, and part 2 starts at the last stop of part 1.
12. Each itinerary day's links open that day's school stops only.
13. Hiding a selected school with the interest filter removes it from the route bar.
14. Check the filter row, selected chips and route bar in Light and Dark modes, following section 2b of `design/the-track-design-guidelines.md`.
